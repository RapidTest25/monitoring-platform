# Lightwatch — Data Model & MongoDB Schema Design

## Overview

| Collection        | Purpose                            | TTL     | Shard Key          |
| ----------------- | ---------------------------------- | ------- | ------------------ |
| `logs`            | Structured application log entries | 30 days | `service` (hashed) |
| `metrics`         | Numeric time-series data points    | 30 days | `service` (hashed) |
| `security_events` | Security incident records          | 90 days | `service` (hashed) |
| `services`        | Live service registry (heartbeats) | —       | —                  |
| `alerts`          | User-defined alerting rules        | —       | —                  |

---

## Timestamp Strategy

Every time-series document carries **two** Date fields:

| Field         | Source                                     | Purpose                                                                 |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `timestamp`   | Client-supplied or normalised at ingestion | **Business time** — the moment the event occurred                       |
| `received_at` | `new Date()` at ingest-node                | **Server wallclock** — used for TTL expiry and ingestion-lag monitoring |

TTL indexes are always placed on `received_at` so that:

- A late-arriving event with an old `timestamp` is not immediately expired.
- The TTL clock is entirely under server control, immune to client clock skew.

---

## 1. `logs`

### Fields

```
_id          ObjectId    auto-generated
service      String      source microservice name                    (required)
level        String      "debug" | "info" | "warn" | "error"        (required)
message      String      free-text body, max 4 096 chars             (required)
meta         Object      arbitrary key/value context                 (optional)
timestamp    Date        event time                                  (required)
received_at  Date        server ingestion wallclock                  (required)
```

### Indexes

| Name                        | Keys                                      | Rationale                                                                                                                                   |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `idx_logs_service_level_ts` | `{ service: 1, level: 1, timestamp: -1 }` | Primary query path — covers `WHERE service=X AND level=Y ORDER BY timestamp DESC` without COLLSCAN. Equality fields first, sort field last. |
| `idx_logs_service_ts`       | `{ service: 1, timestamp: -1 }`           | Covers queries that filter by service without level (avoids scanning the full compound).                                                    |
| `idx_logs_message_text`     | `{ message: "text" }`                     | Text index for `$regex` or `$text` full-text search on message content.                                                                     |
| `idx_logs_ttl`              | `{ received_at: 1 }`                      | TTL index — auto-deletes documents 30 days after ingestion.                                                                                 |

### Query Optimization Notes

- The compound index `(service, level, timestamp)` follows the **ESR rule** (Equality → Sort → Range), placing equality-matched fields before the sort field.
- For paginated queries with `skip/limit`, queries hitting recent data (page 1-2) are fast because the B-tree scan starts at the most recent leaf. Deep pagination (page 100+) should switch to cursor-based (`_id > lastSeen`) for production dashboards.
- Text index on `message` allows `$text` queries; for simple prefix matching, `$regex` with the `service+timestamp` index as a pre-filter is often faster.

---

## 2. `metrics`

### Fields

```
_id          ObjectId    auto-generated
service      String      source microservice name                    (required)
name         String      metric identifier (e.g. "cpu_usage")       (required)
value        Number      metric reading                              (required)
unit         String      e.g. "percent", "bytes", "ms"              (optional)
tags         Object      { host: "srv-01", region: "us-1" }         (optional)
timestamp    Date        event time                                  (required)
received_at  Date        server ingestion wallclock                  (required)
```

### Indexes

| Name                          | Keys                                     | Rationale                                                                                                  |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `idx_metrics_service_name_ts` | `{ service: 1, name: 1, timestamp: -1 }` | Primary compound — covers the dominant query `WHERE service=X AND name=Y ORDER BY timestamp DESC LIMIT N`. |
| `idx_metrics_tag_host_ts`     | `{ "tags.host": 1, timestamp: -1 }`      | Supports cross-service queries like "all metrics from host srv-01". Dot-notation index on nested field.    |
| `idx_metrics_ttl`             | `{ received_at: 1 }`                     | TTL index — auto-deletes documents 30 days after ingestion.                                                |

### Query Optimization Notes

- Metric queries are **limit-based** (default 500) rather than paginated. The compound index provides an efficient `scanAndOrder: false` plan.
- For aggregation pipelines (e.g. average CPU over 1-hour buckets), `$match` on service+name+timestamp range uses the compound index, then `$group` with `$dateTrunc` performs the bucketing in-memory.
- If `tags` queries become frequent, additional indexes on specific tag keys (e.g. `tags.region`) can be added selectively rather than indexing all of `tags` with a wildcard.

---

## 3. `security_events`

### Fields

```
_id          ObjectId    auto-generated
service      String      source service name                         (required)
type         String      "brute_force" | "port_scan" |               (required)
                         "auth_failure" | "malware" | "other"
source_ip    String      origin IP address (v4/v6, max 45 chars)     (required)
description  String      human-readable summary                      (optional)
severity     String      "low" | "medium" | "high" | "critical"     (optional)
meta         Object      arbitrary context                           (optional)
timestamp    Date        event time                                  (required)
received_at  Date        server ingestion wallclock                  (required)
```

### Indexes

| Name                       | Keys                                      | Rationale                                                                                           |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `idx_security_ip_ts`       | `{ source_ip: 1, timestamp: -1 }`         | IP-based investigation — "show me all events from this IP in the last 24h".                         |
| `idx_security_type_sev_ts` | `{ type: 1, severity: 1, timestamp: -1 }` | Drill-down — "all critical brute_force events today". Two equality fields + time sort.              |
| `idx_security_service_ts`  | `{ service: 1, timestamp: -1 }`           | Service-scoped view for per-service security dashboards.                                            |
| `idx_security_ttl`         | `{ received_at: 1 }`                      | TTL index — auto-deletes documents **90 days** after ingestion (longer retention for audit trails). |

### Query Optimization Notes

- Security events are lower volume than logs/metrics but query latency requirements are stricter (incident response).
- The three-key compound `(type, severity, timestamp)` lets the alert evaluator efficiently scan high-severity events of a specific type within a time window.
- For IP-reputation queries that aggregate event counts, a covered index on `(source_ip, type)` can be added if aggregation pipelines become a hot path.

---

## 4. `services`

### Fields

```
_id             ObjectId    auto-generated
name            String      unique microservice identifier           (required)
host            String      hostname or IP of the instance           (optional)
status          String      "healthy" | "degraded" | "offline"       (required)
last_heartbeat  Date        most recent heartbeat timestamp          (required)
meta            Object      { version, uptime, custom labels }      (optional)
created_at      Date        first registration time                  (required)
```

### Indexes

| Name                       | Keys                                | Rationale                                                                                    |
| -------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `idx_services_name_unique` | `{ name: 1 }` **unique**            | Upsert target for heartbeat ingestion (`updateOne` with `upsert: true` on service name).     |
| `idx_services_status_hb`   | `{ status: 1, last_heartbeat: -1 }` | Dashboard "offline services" widget — `WHERE status="offline" ORDER BY last_heartbeat DESC`. |

### Query Optimization Notes

- Low-cardinality collection (tens to hundreds of documents). Indexes are primarily for correctness (unique constraint) rather than performance.
- The heartbeat upsert path (`filter: { name }, update: { $set: { last_heartbeat, status, host, meta } }, upsert: true`) is an atomic single-document operation.
- A background job can set `status: "offline"` for any service whose `last_heartbeat` is older than a configurable threshold (e.g. 5 minutes).

---

## 5. `alerts`

### Fields

```
_id                  ObjectId    auto-generated
name                 String      human-readable alert name            (required)
service              String      target service to evaluate           (required)
condition.metric     String      metric name to watch                 (required)
condition.operator   String      "gt" | "lt" | "eq" | "gte" | "lte" (required)
condition.threshold  Number      comparison value                     (required)
condition.duration   String      sustained window, e.g. "5m"          (optional)
enabled              Boolean     active flag                          (required)
created_at           Date        creation timestamp                   (required)
updated_at           Date        last modification timestamp          (required)
```

### Indexes

| Name                         | Keys                         | Rationale                                                                                 |
| ---------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `idx_alerts_service_enabled` | `{ service: 1, enabled: 1 }` | Evaluator path — "give me all enabled alerts for service X". Used every evaluation cycle. |
| `idx_alerts_created`         | `{ created_at: -1 }`         | Management UI listing — sorted newest-first.                                              |

### Query Optimization Notes

- Low-cardinality collection. The evaluator index is the critical one — it must be fast for the alert-check hot loop.
- `condition` is stored as an embedded sub-document (not a separate collection) because alerts are always read as a whole unit with no fan-out.

---

## Server-Side Validation

MongoDB JSON Schema validators are applied to all five collections at `validationLevel: "moderate"` with `validationAction: "warn"`. This acts as a safety net behind AJV validation in ingest-node:

- **moderate** — validates inserts and updates that modify validated fields; skips already-existing invalid docs.
- **warn** — logs violations to the MongoDB log without rejecting the write.

For strict enforcement, change to `validationLevel: "strict"` and `validationAction: "error"`.

---

## Sharding Strategy

For horizontal scaling, all three high-volume collections use **hashed shard keys** on `service`:

```js
sh.shardCollection("monitoring.logs", { service: "hashed" });
sh.shardCollection("monitoring.metrics", { service: "hashed" });
sh.shardCollection("monitoring.security_events", { service: "hashed" });
```

**Why hashed on `service`:**

| Consideration                    | Hashed `service`                              | Ranged `timestamp`                                    |
| -------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Write distribution               | Even across shards                            | Hot shard on latest chunk                             |
| Scatter-gather on service filter | **Targeted** (single shard)                   | Scatter-gather                                        |
| Time-range only queries          | Scatter-gather                                | Targeted                                              |
| Typical workload fit             | Monitoring dashboards filter by service first | Pure time-range scans are rare without service filter |

Compound indexes within each shard still cover the `timestamp` sort, so queries like `WHERE service=X ORDER BY timestamp DESC` are **targeted to one shard and index-backed**.

---

## Index Summary

| Collection        | Total Indexes             | Estimated Working Set                        |
| ----------------- | ------------------------- | -------------------------------------------- |
| `logs`            | 4 (compound + text + TTL) | High — benefits from WiredTiger cache sizing |
| `metrics`         | 3 (compound + tag + TTL)  | Highest — continuous numeric writes          |
| `security_events` | 4 (3 compound + TTL)      | Moderate — event-driven                      |
| `services`        | 2 (unique + status)       | Tiny — fits in RAM                           |
| `alerts`          | 2 (compound + sort)       | Tiny — fits in RAM                           |

---

## TTL Summary

| Collection        | TTL Field     | Retention |
| ----------------- | ------------- | --------- |
| `logs`            | `received_at` | 30 days   |
| `metrics`         | `received_at` | 30 days   |
| `security_events` | `received_at` | 90 days   |
| `services`        | —             | No expiry |
| `alerts`          | —             | No expiry |

To adjust retention at runtime without redeployment:

```js
db.runCommand({
  collMod: "logs",
  index: { name: "idx_logs_ttl", expireAfterSeconds: NEW_VALUE },
});
```

---

## Redis Streams

| Stream Key        | Payload                        | Consumer Group   |
| ----------------- | ------------------------------ | ---------------- |
| `stream:logs`     | Normalized log event JSON      | `realtime-group` |
| `stream:metrics`  | Normalized metric event JSON   | `realtime-group` |
| `stream:security` | Normalized security event JSON | `realtime-group` |
| `stream:alerts`   | Triggered alert JSON           | `realtime-group` |
