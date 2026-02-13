// ============================================================================
// Lightwatch — MongoDB Initialization Script
// ============================================================================
//
// Collections: logs, metrics, security_events, services, alerts
//
// Design principles:
//   1.  Every high-volume collection uses a TTL index on `received_at` so
//       the clock used for expiry is always under our control (not the
//       client-supplied `timestamp`).
//   2.  Compound indexes are ordered to match the most selective filter
//       field first, ending with the sort key (timestamp descending) so
//       the query planner can satisfy both filter and sort from the index.
//   3.  `timestamp` is the business/event time (client-supplied or
//       normalised at ingestion).  `received_at` is the server-side wall
//       clock written by ingest-node.
//   4.  All shard key candidates use a hashed leading field on `service`
//       for even distribution, with `_id` as the range tail for unique
//       guarantee.  Actual enableSharding / shardCollection commands are
//       commented out — uncomment when moving to a sharded cluster.
// ============================================================================

db = db.getSiblingDB("monitoring");

// ── helpers ──────────────────────────────────────────────────────────────────

function safe(fn) {
  try {
    fn();
  } catch (e) {
    /* index/collection already exists — ignore */
  }
}

function ensureCollection(name) {
  const existing = db.getCollectionNames();
  if (existing.indexOf(name) === -1) {
    db.createCollection(name);
  }
}

const TTL_30_DAYS = 30 * 24 * 60 * 60; // 2 592 000 s
const TTL_90_DAYS = 90 * 24 * 60 * 60; // 7 776 000 s
const TTL_365_DAYS = 365 * 24 * 60 * 60; // 31 536 000 s

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  1.  LOGS                                                              │
// │                                                                        │
// │  Fields:                                                               │
// │    _id          ObjectId   (auto)                                       │
// │    service      String     source microservice name                     │
// │    level        String     debug | info | warn | error                  │
// │    message      String     free-text, max 4 096 chars                   │
// │    meta         Object     arbitrary key/value context (optional)       │
// │    timestamp    Date       event time (client or normalised)            │
// │    received_at  Date       server ingestion wallclock                   │
// │                                                                        │
// │  Query patterns (from logs_repository.go):                             │
// │    • filter by service + level + time range, sort by timestamp desc     │
// │    • free-text regex search on message                                  │
// │    • paginated with skip/limit                                          │
// └─────────────────────────────────────────────────────────────────────────┘

ensureCollection("logs");

// Primary query path — covers service + level equality + time-range scan.
// Ordering: service (equality) → level (equality) → timestamp (range+sort).
safe(() =>
  db.logs.createIndex(
    { service: 1, level: 1, timestamp: -1 },
    { name: "idx_logs_service_level_ts", background: true },
  ),
);

// Covers queries that filter by service only (without level).
safe(() =>
  db.logs.createIndex(
    { service: 1, timestamp: -1 },
    { name: "idx_logs_service_ts", background: true },
  ),
);

// Text search on message for regex/full-text queries.
safe(() =>
  db.logs.createIndex(
    { message: "text" },
    { name: "idx_logs_message_text", background: true },
  ),
);

// TTL — expire on server-controlled received_at (30 days default).
safe(() =>
  db.logs.createIndex(
    { received_at: 1 },
    { name: "idx_logs_ttl", expireAfterSeconds: TTL_30_DAYS, background: true },
  ),
);

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  2.  METRICS                                                           │
// │                                                                        │
// │  Fields:                                                               │
// │    _id          ObjectId   (auto)                                       │
// │    service      String     source microservice name                     │
// │    name         String     metric identifier (e.g. cpu_usage)           │
// │    value        Number     metric reading                               │
// │    unit         String     e.g. percent, bytes, ms  (optional)          │
// │    tags         Object     { host: "srv-01", region: "us-1" }           │
// │    timestamp    Date       event time                                   │
// │    received_at  Date       server ingestion wallclock                   │
// │                                                                        │
// │  Query patterns (from metrics_repository.go):                          │
// │    • filter by service + name + time range, sort by timestamp desc      │
// │    • limit-based (no skip pagination, default 500)                      │
// └─────────────────────────────────────────────────────────────────────────┘

ensureCollection("metrics");

// Primary compound — covers the dominant query service + name + time range.
safe(() =>
  db.metrics.createIndex(
    { service: 1, name: 1, timestamp: -1 },
    { name: "idx_metrics_service_name_ts", background: true },
  ),
);

// Tag-based lookup (e.g. "all metrics from host X").
safe(() =>
  db.metrics.createIndex(
    { "tags.host": 1, timestamp: -1 },
    { name: "idx_metrics_tag_host_ts", background: true },
  ),
);

// TTL — 30 days on received_at.
safe(() =>
  db.metrics.createIndex(
    { received_at: 1 },
    {
      name: "idx_metrics_ttl",
      expireAfterSeconds: TTL_30_DAYS,
      background: true,
    },
  ),
);

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  3.  SECURITY_EVENTS                                                   │
// │                                                                        │
// │  Fields:                                                               │
// │    _id          ObjectId   (auto)                                       │
// │    service      String     source service name                          │
// │    type         String     brute_force | port_scan | auth_failure |     │
// │                            malware | other                              │
// │    source_ip    String     origin IP (v4/v6, max 45 chars)              │
// │    description  String     human-readable summary  (optional)           │
// │    severity     String     low | medium | high | critical               │
// │    meta         Object     arbitrary context  (optional)                │
// │    timestamp    Date       event time                                   │
// │    received_at  Date       server ingestion wallclock                   │
// │                                                                        │
// │  Query patterns (from security_repository.go):                         │
// │    • filter by source_ip + type + time range, sort by timestamp desc    │
// │    • filter by severity + time range                                    │
// └─────────────────────────────────────────────────────────────────────────┘

ensureCollection("security_events");

// Primary — IP-based investigation with time bounds.
safe(() =>
  db.security_events.createIndex(
    { source_ip: 1, timestamp: -1 },
    { name: "idx_security_ip_ts", background: true },
  ),
);

// Type + severity drill-down (e.g. "all critical brute_force today").
safe(() =>
  db.security_events.createIndex(
    { type: 1, severity: 1, timestamp: -1 },
    { name: "idx_security_type_sev_ts", background: true },
  ),
);

// Service-scoped view — "show me all security events for service X".
safe(() =>
  db.security_events.createIndex(
    { service: 1, timestamp: -1 },
    { name: "idx_security_service_ts", background: true },
  ),
);

// TTL — 90 days (security data retained longer for audit trails).
safe(() =>
  db.security_events.createIndex(
    { received_at: 1 },
    {
      name: "idx_security_ttl",
      expireAfterSeconds: TTL_90_DAYS,
      background: true,
    },
  ),
);

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  4.  SERVICES  (heartbeat registry)                                    │
// │                                                                        │
// │  Fields:                                                               │
// │    _id             ObjectId   (auto)                                    │
// │    name            String     unique microservice identifier            │
// │    host            String     hostname / IP of the instance             │
// │    status          String     healthy | degraded | offline              │
// │    last_heartbeat  Date       most recent heartbeat timestamp           │
// │    meta            Object     version, uptime, custom labels            │
// │    created_at      Date       first registration time                   │
// │                                                                        │
// │  Query patterns:                                                       │
// │    • upsert by name (ingest heartbeat)                                 │
// │    • list all services                                                 │
// │    • filter by status (dashboard "offline services" widget)             │
// └─────────────────────────────────────────────────────────────────────────┘

ensureCollection("services");

// Unique constraint — one document per service name (heartbeat upsert target).
safe(() =>
  db.services.createIndex(
    { name: 1 },
    { name: "idx_services_name_unique", unique: true, background: true },
  ),
);

// Status filter for dashboard queries.
safe(() =>
  db.services.createIndex(
    { status: 1, last_heartbeat: -1 },
    { name: "idx_services_status_hb", background: true },
  ),
);

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  5.  ALERTS  (rule definitions)                                        │
// │                                                                        │
// │  Fields:                                                               │
// │    _id                ObjectId   (auto)                                 │
// │    name               String     human-readable alert name              │
// │    service            String     target service to evaluate             │
// │    condition.metric   String     metric name to watch                   │
// │    condition.operator String     gt | lt | eq | gte | lte               │
// │    condition.threshold Number    comparison value                       │
// │    condition.duration String     sustained window e.g. "5m" (opt)       │
// │    enabled            Boolean    active flag                            │
// │    created_at         Date       creation timestamp                     │
// │    updated_at         Date       last modification timestamp            │
// │                                                                        │
// │  Query patterns:                                                       │
// │    • list all, sorted by created_at desc                                │
// │    • filter by service + enabled (alert evaluator)                      │
// │    • CRUD by _id                                                        │
// └─────────────────────────────────────────────────────────────────────────┘

ensureCollection("alerts");

// Evaluator path — "give me all enabled alerts for service X".
safe(() =>
  db.alerts.createIndex(
    { service: 1, enabled: 1 },
    { name: "idx_alerts_service_enabled", background: true },
  ),
);

// Listing / management sorted by creation time.
safe(() =>
  db.alerts.createIndex(
    { created_at: -1 },
    { name: "idx_alerts_created", background: true },
  ),
);

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  6.  SCHEMA VALIDATION  (server-side)                                  │
// │                                                                        │
// │  MongoDB JSON Schema validators act as a safety net behind             │
// │  AJV validation in ingest-node.  Level "warn" logs invalid docs        │
// │  without rejecting writes — set to "strict" for hard enforcement.      │
// └─────────────────────────────────────────────────────────────────────────┘

db.runCommand({
  collMod: "logs",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["service", "level", "message", "timestamp", "received_at"],
      properties: {
        service: { bsonType: "string" },
        level: { bsonType: "string", enum: ["debug", "info", "warn", "error"] },
        message: { bsonType: "string" },
        meta: { bsonType: "object" },
        timestamp: { bsonType: "date" },
        received_at: { bsonType: "date" },
      },
    },
  },
  validationLevel: "moderate",
  validationAction: "warn",
});

db.runCommand({
  collMod: "metrics",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["service", "name", "value", "timestamp", "received_at"],
      properties: {
        service: { bsonType: "string" },
        name: { bsonType: "string" },
        value: { bsonType: "number" },
        unit: { bsonType: "string" },
        tags: { bsonType: "object" },
        timestamp: { bsonType: "date" },
        received_at: { bsonType: "date" },
      },
    },
  },
  validationLevel: "moderate",
  validationAction: "warn",
});

db.runCommand({
  collMod: "security_events",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["service", "type", "source_ip", "timestamp", "received_at"],
      properties: {
        service: { bsonType: "string" },
        type: {
          bsonType: "string",
          enum: [
            "brute_force",
            "port_scan",
            "auth_failure",
            "malware",
            "other",
          ],
        },
        source_ip: { bsonType: "string" },
        severity: {
          bsonType: "string",
          enum: ["low", "medium", "high", "critical"],
        },
        description: { bsonType: "string" },
        meta: { bsonType: "object" },
        timestamp: { bsonType: "date" },
        received_at: { bsonType: "date" },
      },
    },
  },
  validationLevel: "moderate",
  validationAction: "warn",
});

db.runCommand({
  collMod: "alerts",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "service", "condition", "enabled"],
      properties: {
        name: { bsonType: "string" },
        service: { bsonType: "string" },
        enabled: { bsonType: "bool" },
        condition: {
          bsonType: "object",
          required: ["metric", "operator", "threshold"],
          properties: {
            metric: { bsonType: "string" },
            operator: {
              bsonType: "string",
              enum: ["gt", "lt", "eq", "gte", "lte"],
            },
            threshold: { bsonType: "number" },
            duration: { bsonType: "string" },
          },
        },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },
  validationLevel: "moderate",
  validationAction: "warn",
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  7.  SHARDING PREPARATION  (uncomment on sharded clusters)             │
// │                                                                        │
// │  Shard key strategy:                                                   │
// │    • logs:             { service: "hashed" }                            │
// │    • metrics:          { service: "hashed" }                            │
// │    • security_events:  { service: "hashed" }                            │
// │                                                                        │
// │  Hashed on `service` distributes writes evenly across shards.          │
// │  Range queries on timestamp still work within each chunk because       │
// │  the compound indexes provide intra-shard sort coverage.               │
// └─────────────────────────────────────────────────────────────────────────┘

// sh.enableSharding("monitoring");
// sh.shardCollection("monitoring.logs",            { service: "hashed" });
// sh.shardCollection("monitoring.metrics",         { service: "hashed" });
// sh.shardCollection("monitoring.security_events", { service: "hashed" });

print(
  "✓ Lightwatch MongoDB initialized — 5 collections, indexes, validators, TTLs",
);
