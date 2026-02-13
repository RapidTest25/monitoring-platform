# Lightwatch — Backend Monitoring Platform

[![Build](https://img.shields.io/github/actions/workflow/status/lightwatch/monitoring-platform/ci.yml?branch=main&label=build)](https://github.com/lightwatch/monitoring-platform/actions)
[![Test Coverage](https://img.shields.io/codecov/c/github/lightwatch/monitoring-platform?label=coverage)](https://codecov.io/gh/lightwatch/monitoring-platform)
[![Go Version](https://img.shields.io/badge/go-%3E%3D1.22-00ADD8?logo=go)](https://go.dev)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker)](infra/docker-compose.yml)

Lightwatch is a lightweight, open-source backend monitoring platform designed to collect, store, query, and stream infrastructure metrics, application logs, and security events in real time. It provides a complete observability pipeline for backend services — from ingestion to alerting — built with minimal dependencies and native standard-library HTTP servers.

---

## Table of Contents

- [What is Lightwatch?](#what-is-lightwatch)
- [When Should You Use Lightwatch?](#when-should-you-use-lightwatch)
- [Comparison With Existing Tools](#comparison-with-existing-tools)
- [Design Decisions](#design-decisions)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [System Guarantees](#system-guarantees)
- [Versioning & Migration](#versioning--migration)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Ingestion API](#1-ingestion-api-ingest-node--port-3001)
  - [Query API](#2-query-api-api-go--port-3003)
  - [WebSocket API](#3-websocket-api-realtime-node--port-3002)
- [Event Schemas](#event-schemas)
- [Alert Engine](#alert-engine)
- [Performance & Benchmarks](#performance--benchmarks)
- [Scaling Model](#scaling-model)
- [Failure Handling & Resilience](#failure-handling--resilience)
- [Security Model](#security-model)
- [Deployment Modes](#deployment-modes)
- [Self-Monitoring](#self-monitoring)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Development](#development)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## What is Lightwatch?

Lightwatch solves the problem of monitoring backend infrastructure without relying on heavy, proprietary solutions. If you run multiple backend services and need to:

- **Collect metrics** (CPU, memory, request latency, custom business metrics)
- **Aggregate logs** (structured JSON logs from all your services in one place)
- **Track security events** (brute force attempts, port scans, auth failures)
- **Monitor service health** (heartbeats, uptime, version tracking)
- **Get real-time alerts** (threshold-based detection with webhook notifications)
- **Stream events live** (WebSocket-based dashboards and monitoring tools)

...then Lightwatch provides all of these capabilities through a simple HTTP + WebSocket API that any service or agent can integrate with in minutes.

---

## When Should You Use Lightwatch?

Lightwatch is designed for teams and developers who need observability without the operational overhead of enterprise-grade monitoring stacks.

| You are...                               | Lightwatch fits because...                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Indie developer / solo founder**       | One `docker compose up` gives you full observability — no Kubernetes, no Helm charts, no YAML hell                                         |
| **Small SaaS team (2–15 engineers)**     | Lightweight enough to run on a single $20/month VPS alongside your app                                                                     |
| **Student learning distributed systems** | Clean, readable codebase with clear separation — microservices, event streaming, WebSocket, clean architecture patterns all in one project |
| **Backend engineer prototyping**         | Get metrics + logs + alerts running in 5 minutes instead of configuring Prometheus + Grafana + AlertManager + Loki                         |
| **Team migrating from print-debugging**  | Dead simple HTTP API — any language can `POST /ingest/logs` with a JSON body                                                               |
| **IoT / edge computing projects**        | Minimal resource footprint — runs on ARM, no JVM, no heavy agents                                                                          |

### When Lightwatch is NOT the right choice

- You need **petabyte-scale** log storage → use Elasticsearch / ClickHouse
- You need **PromQL-compatible** metric queries → use Prometheus / Thanos
- You need **full APM** with distributed tracing UI → use Jaeger / Datadog
- You already run a **Kubernetes cluster** with built-in observability → use the kube-native stack
- You need **compliance-certified** monitoring (SOC2, HIPAA) → use a managed SaaS

---

## Comparison With Existing Tools

| Feature                       | Lightwatch                         | Prometheus + Grafana                            | ELK Stack                               | Datadog                     | Grafana Loki                 |
| ----------------------------- | ---------------------------------- | ----------------------------------------------- | --------------------------------------- | --------------------------- | ---------------------------- |
| **Setup complexity**          | `docker compose up`                | Prometheus + Grafana + AlertManager + exporters | Elasticsearch + Logstash + Kibana       | SaaS signup + agent install | Loki + Promtail + Grafana    |
| **Logs + Metrics + Security** | Single platform                    | Metrics only (need Loki for logs)               | Logs only (need Prometheus for metrics) | All-in-one (paid)           | Logs only                    |
| **Real-time streaming**       | Native WebSocket                   | Grafana Live (limited)                          | Kibana refresh polling                  | Live tail (paid)            | LogCLI tail                  |
| **Alert engine**              | Built-in (threshold)               | AlertManager (separate)                         | Watcher / ElastAlert                    | Built-in (paid)             | Ruler (separate)             |
| **Resource footprint**        | ~100MB RAM total                   | ~500MB+ RAM                                     | 2GB+ RAM (JVM)                          | Agent ~100MB                | ~200MB RAM                   |
| **Language/runtime**          | Go + Node.js (native http)         | Go                                              | Java (JVM)                              | Agent: Go/Python            | Go                           |
| **Cost**                      | Free (open source)                 | Free (open source)                              | Free (open source)                      | $15+/host/month             | Free (open source)           |
| **Learning curve**            | Simple HTTP API                    | PromQL + YAML configs                           | Lucene query syntax                     | Proprietary UI              | LogQL                        |
| **Dependencies**              | MongoDB + Redis                    | TSDB (local storage)                            | JVM + storage cluster                   | Cloud SaaS                  | Object storage (S3)          |
| **Best for**                  | Small teams, learning, prototyping | Production metrics at scale                     | Enterprise log analytics                | Enterprise full-stack APM   | Cloud-native log aggregation |

### Philosophy Differences

| Aspect                 | Lightwatch approach                                          | Traditional approach                                 |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| **Data ingestion**     | Push-based HTTP API — services send events directly          | Pull-based scraping (Prometheus) or agents (Datadog) |
| **Query language**     | REST query parameters — no DSL to learn                      | PromQL, LogQL, Lucene, proprietary DSLs              |
| **Real-time delivery** | Redis Streams → WebSocket (sub-second)                       | Polling-based dashboards (5–30s refresh)             |
| **Event model**        | Unified schema (logs, metrics, security share common fields) | Separate systems for each telemetry type             |
| **Deployment**         | Single Docker Compose file                                   | Multiple services with complex orchestration         |

---

## Design Decisions

Key architectural choices and why they were made. These serve as lightweight Architecture Decision Records (ADRs).

### Why MongoDB instead of PostgreSQL?

| Factor                 | MongoDB                                                          | PostgreSQL                                                   |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| **Schema flexibility** | Schemaless documents — event types can evolve without migrations | Rigid schema requires ALTER TABLE for new fields             |
| **TTL expiration**     | Native TTL indexes delete expired documents automatically        | Requires cron jobs or pg_partman for time-based retention    |
| **Write throughput**   | Optimized for high-volume inserts with WiredTiger                | Write-heavy workloads need careful tuning (WAL, checkpoints) |
| **JSON native**        | Documents stored as BSON — no JSON↔relational mapping            | JSONB works but adds overhead vs row storage                 |
| **Horizontal scaling** | Built-in sharding with hashed shard keys                         | Requires Citus or manual partitioning                        |

**Decision:** Monitoring data is append-heavy, schema-variable, and time-series-like. MongoDB's TTL indexes, flexible schemas, and native sharding align perfectly.

### Why Redis Streams instead of Kafka?

| Factor                     | Redis Streams                         | Apache Kafka                            |
| -------------------------- | ------------------------------------- | --------------------------------------- |
| **Operational complexity** | Single binary, 10MB RAM idle          | JVM broker + ZooKeeper/KRaft, 1GB+ RAM  |
| **Setup**                  | `docker run redis`                    | Multi-node cluster, topic configuration |
| **Consumer groups**        | Built-in (`XREADGROUP`, `XACK`)       | Built-in (more sophisticated)           |
| **Throughput ceiling**     | ~100K msg/s (single node)             | Millions msg/s (clustered)              |
| **Persistence**            | AOF with configurable fsync           | Replicated log (stronger guarantees)    |
| **Best for**               | Small-to-medium workloads, simplicity | Enterprise-scale event streaming        |

**Decision:** Lightwatch targets small-to-medium deployments where operational simplicity matters more than Kafka's massive throughput ceiling. Redis is already in the stack — no additional infrastructure.

### Why push-based ingestion instead of pull-based (Prometheus-style)?

| Factor                    | Push (Lightwatch)                                         | Pull (Prometheus)                                      |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| **Service discovery**     | Not required — services push when ready                   | Requires target registration (static or DNS-SD)        |
| **Firewall friendliness** | Outbound HTTP from services (easy)                        | Inbound scrape to every service (hard in NAT/firewall) |
| **Event types**           | Any event (logs, security, heartbeats) — not just metrics | Designed for numeric time-series metrics only          |
| **Control**               | Services decide when and what to send                     | Scraper controls polling interval                      |
| **Serverless/Lambda**     | Works — POST on invocation                                | Doesn't work — short-lived instances can't be scraped  |

**Decision:** Push-based is more flexible (supports logs + metrics + security events), works behind firewalls, and requires zero service discovery infrastructure.

### Why native `http` / `net/http` instead of Express / Gin?

| Factor             | Native stdlib                             | Frameworks                                                      |
| ------------------ | ----------------------------------------- | --------------------------------------------------------------- |
| **Dependencies**   | Zero (Node.js) / zero (Go)                | express: 30+ transitive deps / gin: 10+ deps                    |
| **Attack surface** | Only Node.js/Go runtime CVEs              | Framework + dependency CVEs (e.g., express prototype pollution) |
| **Performance**    | No middleware overhead                    | Middleware chain adds latency                                   |
| **Binary size**    | Go: ~8MB / Node: 0 added                  | Go: +5MB / Node: +3MB node_modules                              |
| **Learning**       | Standard library — transferable knowledge | Framework-specific APIs                                         |

**Decision:** Lightwatch uses minimal dependencies by design. Native HTTP modules reduce attack surface, simplify auditing, and eliminate dependency supply-chain risks.

---

## Architecture

Lightwatch is a microservices platform composed of three services, backed by MongoDB for persistent storage and Redis Streams for real-time event delivery.

```
                    ┌─────────────────────────────────────────────────┐
                    │                  Traefik Gateway                │
                    │               (port 80 / 8080)                 │
                    │                                                 │
                    │  /ingest/*  →  ingest-node   (rate: 200/s)     │
                    │  /api/*     →  api-go         (rate: 100/s)     │
                    │  /ws/*      →  realtime-node                    │
                    └─────┬──────────────┬──────────────┬─────────────┘
                          │              │              │
              ┌───────────▼──┐   ┌───────▼───────┐ ┌───▼──────────────┐
              │  Ingest Node │   │    API (Go)    │ │  Realtime Node   │
              │  (port 3001) │   │  (port 3003)   │ │  (port 3002)     │
              │              │   │                │ │                  │
              │ • Validate   │   │ • Query logs   │ │ • WebSocket hub  │
              │ • Normalize  │   │ • Query metrics│ │ • Channel-based  │
              │ • Persist    │   │ • Query security│ │   subscriptions │
              │ • Stream     │   │ • Manage alerts│ │ • JWT/API key    │
              └──┬───────┬───┘   │ • Alert engine │ │   auth           │
                 │       │       └───────┬────────┘ └────────▲─────────┘
                 │       │               │                   │
                 ▼       ▼               ▼                   │
            ┌────────┐ ┌─────────────────────┐               │
            │ MongoDB│ │    Redis Streams     │───────────────┘
            │ Atlas  │ │ stream:logs          │  (consumer group
            │        │ │ stream:metrics       │   subscription)
            │        │ │ stream:security      │
            │        │ │ stream:alerts        │
            └────────┘ └─────────────────────┘
```

| Component         | Technology              | Port      | Role                                                      |
| ----------------- | ----------------------- | --------- | --------------------------------------------------------- |
| **Ingest Node**   | Node.js / native `http` | 3001      | Receives, validates, persists, and streams events         |
| **Realtime Node** | Node.js / `ws`          | 3002      | WebSocket hub — streams events to connected clients       |
| **API (Go)**      | Go 1.22 / `net/http`    | 3003      | Query historical data, manage alerts, run alert engine    |
| **MongoDB**       | Atlas / 7.0             | —         | Persistent storage with TTL indexes and schema validation |
| **Redis**         | 7.x Streams             | 6379      | Real-time event pipeline between ingest and realtime      |
| **Traefik**       | v2.11                   | 80 / 8080 | API gateway with rate limiting and security headers       |

---

## How It Works

### Data Flow

1. **Your backend services** send events via HTTP POST to the Ingestion API
2. **Ingest Node** validates the payload against JSON schemas (AJV), normalizes timestamps, generates an `event_id` if not provided, and sets `schema_version: 2`
3. **Ingest Node** persists the event to MongoDB and simultaneously publishes it to a Redis Stream
4. **Realtime Node** subscribes to Redis Streams using consumer groups, picks up new events, and broadcasts them to all WebSocket clients subscribed to that channel
5. **API (Go)** queries MongoDB for historical data with pagination, filtering, and time-range support
6. **Alert Engine** (background goroutine in the Go service) evaluates alert rules every 30 seconds, checks recent metric values against thresholds, and triggers webhook notifications when conditions are breached

### Request Flow Example

```
Your App                  Lightwatch                       Dashboard
─────────────────────────────────────────────────────────────────────

POST /ingest/logs ───────► Ingest Node
  {                         ├─ validate (AJV)
    "service": "payments",  ├─ normalize (add event_id, timestamp)
    "level": "error",       ├─ db.logs.insertOne(event)
    "message": "timeout"    └─ redis.xadd("stream:logs", event)
  }                                    │
                                       ▼
                              Redis Stream "stream:logs"
                                       │
                              Realtime Node (consumer group)
                                       │
                                       ▼
                              WebSocket broadcast ─────────► ws://host/ws/logs
                                                              (live event appears
                                                               on dashboard)
```

---

## System Guarantees

Understanding the trade-offs Lightwatch makes is important for choosing the right deployment strategy.

| Guarantee               | Level                  | Details                                                                                                                                                                                                 |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event delivery**      | At-least-once          | Events are persisted to MongoDB before ACK. Redis Streams use consumer groups with explicit XACK — unacknowledged messages are redelivered on reconnect. Duplicate events are possible during failover. |
| **Storage consistency** | Eventually consistent  | MongoDB writes use `w:majority` (configurable). Reads from secondaries may lag by milliseconds.                                                                                                         |
| **Ordering**            | Per-stream ordered     | Redis Streams guarantee ordering within a single stream (e.g., `stream:logs`). Cross-stream ordering is not guaranteed.                                                                                 |
| **Durability**          | Persistent             | MongoDB persists to disk with journaling. Redis uses AOF persistence (`appendonly yes`) with configurable fsync.                                                                                        |
| **Availability**        | Single-node by default | Single points of failure in default deployment. See [Scaling Model](#scaling-model) for HA configuration.                                                                                               |
| **Schema enforcement**  | Strict on ingestion    | AJV validates all incoming events with `additionalProperties: false`. MongoDB validators run in `warn` mode as a safety net.                                                                            |
| **Data retention**      | TTL-based automatic    | Logs and metrics: 30 days. Security events: 90 days. Configurable via MongoDB TTL indexes.                                                                                                              |
| **Latency**             | Sub-second end-to-end  | Ingestion to WebSocket delivery typically < 100ms under normal load.                                                                                                                                    |

### What Lightwatch does NOT guarantee

- **Exactly-once delivery** — Consumer crashes can cause redelivery. Idempotent consumers should use `event_id` for deduplication.
- **Global ordering** — Events across different streams (logs vs metrics) have no ordering guarantee.
- **Zero data loss on hard crash** — Redis AOF may lose up to 1 second of data depending on fsync policy.

---

## Versioning & Migration

### Semantic Versioning

Lightwatch follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
  │     │     └── Bug fixes, no API changes
  │     └──────── New features, backward-compatible
  └────────────── Breaking changes
```

| Version bump      | When                                          | Example                             |
| ----------------- | --------------------------------------------- | ----------------------------------- |
| **PATCH** (1.0.x) | Bug fix, typo, performance tweak              | Fix alert engine missing null check |
| **MINOR** (1.x.0) | New endpoint, new event field, new alert type | Add `POST /ingest/batch` endpoint   |
| **MAJOR** (x.0.0) | Breaking API change, schema incompatibility   | Remove deprecated `v1` event fields |

### Backward Compatibility Guarantees

| Component                | Guarantee                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **REST API endpoints**   | Existing endpoints will not change behavior within a MAJOR version. New optional query parameters may be added in MINOR releases. |
| **Event schemas**        | New optional fields may be added in MINOR releases. Required fields will not be added or removed within a MAJOR version.          |
| **WebSocket protocol**   | Message format will not change within a MAJOR version. New channels may be added in MINOR releases.                               |
| **Configuration (.env)** | Existing env vars will not be renamed or removed within a MAJOR version. New optional vars may be added with sensible defaults.   |

### Schema Migration Strategy

Lightwatch uses `schema_version` on every event to support rolling migrations without downtime.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Producer v1  │     │ Producer v2  │     │ Producer v3  │
│ schema_ver=1 │     │ schema_ver=2 │     │ schema_ver=3 │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────┐
│           Ingest Node (accepts all versions)        │
│  • Validates against schema_version-specific rules  │
│  • Normalizes to latest format on write             │
└─────────────────────────────────────────────────────┘
```

**Migration workflow for schema changes:**

1. **Add new schema version** — Create `v3` schema in `packages/contracts/events/`
2. **Update ingest validation** — Add version-aware validation branch in `validate.js`
3. **Update normalizer** — `normalize.js` transforms old versions to latest format
4. **Deploy ingest first** — New ingest accepts both old and new schemas
5. **Migrate producers gradually** — Services update at their own pace
6. **Backfill (if needed)** — Run a one-time MongoDB aggregation to update old documents:

```javascript
// Example: Backfill v1 events to v2 format
db.logs.updateMany({ schema_version: { $exists: false } }, [
  {
    $set: {
      schema_version: 2,
      event_id: { $toString: "$_id" },
      trace_id: null,
    },
  },
]);
```

7. **Deprecate old version** — After all producers migrate, remove old schema support in next MAJOR release

**Current schema versions:**

| Collection | Current version     | Fields added in v2                                       |
| ---------- | ------------------- | -------------------------------------------------------- |
| logs       | `schema_version: 2` | `event_id`, `trace_id`, `schema_version`, `meta`, `tags` |
| metrics    | `schema_version: 2` | `event_id`, `trace_id`, `schema_version`, `meta`, `tags` |
| security   | `schema_version: 2` | `event_id`, `trace_id`, `schema_version`, `meta`, `tags` |
| heartbeats | `schema_version: 2` | `status`, `version`, `tags`                              |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- MongoDB Atlas account (or local MongoDB 7.0)
- Node.js ≥ 18 and Go ≥ 1.22 (for local development)

### Using Docker Compose

```bash
# 1. Clone the repository
git clone <repo-url> && cd monitoring-platform

# 2. Configure environment
cp infra/.env.example infra/.env
# Edit infra/.env — set MONGO_URI to your MongoDB connection string

# 3. Start all services
cd infra && docker compose up -d --build

# 4. Verify
curl http://localhost/api/health
# → {"status":"ok","service":"api-go"}
```

### Send Your First Event

```bash
# Send a log event
curl -X POST http://localhost/ingest/logs \
  -H "Content-Type: application/json" \
  -d '{
    "service": "my-app",
    "level": "info",
    "message": "Application started successfully",
    "trace_id": "abc-123"
  }'
# → {"status":"accepted","id":"..."}

# Query it back
curl "http://localhost/api/logs?service=my-app&limit=10"
# → {"data":[...],"total":1,"page":1,"limit":10}
```

---

## API Reference

All endpoints return JSON. Paginated endpoints return the standard envelope:

```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 50
}
```

### 1. Ingestion API (Ingest Node — port 3001)

These endpoints receive events from your backend services. Each event is validated, stored in MongoDB, and published to Redis Streams for real-time delivery.

| Method | Path                | Description                 |
| ------ | ------------------- | --------------------------- |
| POST   | `/ingest/metrics`   | Push metric data points     |
| POST   | `/ingest/logs`      | Push structured log entries |
| POST   | `/ingest/security`  | Push security events        |
| POST   | `/ingest/heartbeat` | Service heartbeat / health  |
| GET    | `/health`           | Ingest service health check |

#### POST `/ingest/metrics`

Send a metric data point (CPU usage, response time, queue length, etc.).

```bash
curl -X POST http://localhost:3001/ingest/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "service": "api-gateway",
    "name": "request_latency_ms",
    "value": 42.5,
    "unit": "ms",
    "tags": { "endpoint": "/users", "method": "GET" },
    "trace_id": "req-abc-123"
  }'
```

**Response:** `201 Created`

```json
{ "status": "accepted", "id": "67a1b2c3d4e5f6..." }
```

#### POST `/ingest/logs`

Send a structured log entry.

```bash
curl -X POST http://localhost:3001/ingest/logs \
  -H "Content-Type: application/json" \
  -d '{
    "service": "payment-service",
    "level": "error",
    "message": "Payment gateway timeout after 30s",
    "meta": { "gateway": "stripe", "order_id": "ORD-9876" },
    "tags": { "region": "us-east-1" },
    "trace_id": "tx-xyz-789"
  }'
```

**Supported log levels:** `debug`, `info`, `warn`, `error`, `fatal`

#### POST `/ingest/security`

Report a security event (intrusion attempt, auth failure, etc.).

```bash
curl -X POST http://localhost:3001/ingest/security \
  -H "Content-Type: application/json" \
  -d '{
    "service": "auth-service",
    "type": "brute_force",
    "source_ip": "203.0.113.42",
    "severity": "high",
    "description": "50 failed login attempts in 5 minutes",
    "meta": { "username": "admin", "attempts": 50 }
  }'
```

**Supported types:** `brute_force`, `port_scan`, `auth_failure`, `malware`, `injection`, `xss`, `ddos`, `privilege_escalation`, `other`

**Severity levels:** `low`, `medium`, `high`, `critical`

#### POST `/ingest/heartbeat`

Register a service heartbeat. Creates the service entry on first call, updates status on subsequent calls.

```bash
curl -X POST http://localhost:3001/ingest/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "service": "worker-queue",
    "host": "worker-01.internal",
    "status": "healthy",
    "version": "2.1.0",
    "meta": { "uptime_seconds": 86400, "pid": 1234 }
  }'
```

**Status values:** `healthy`, `degraded`, `unhealthy`

---

### 2. Query API (API Go — port 3003)

These endpoints query historical data stored in MongoDB. All list endpoints support pagination and filtering.

| Method | Path            | Description              |
| ------ | --------------- | ------------------------ |
| GET    | `/api/logs`     | Query log events         |
| GET    | `/api/metrics`  | Query metric events      |
| GET    | `/api/security` | Query security events    |
| GET    | `/api/services` | List registered services |
| GET    | `/api/alerts`   | List alert rules         |
| POST   | `/api/alerts`   | Create an alert rule     |
| GET    | `/api/health`   | API service health check |

#### Common Query Parameters

All list endpoints accept these pagination parameters:

| Parameter | Type   | Default | Description                 |
| --------- | ------ | ------- | --------------------------- |
| `page`    | int    | 1       | Page number (1-based)       |
| `limit`   | int    | 50      | Results per page (max 500)  |
| `from`    | string | —       | Start time (RFC3339 format) |
| `to`      | string | —       | End time (RFC3339 format)   |

#### GET `/api/logs`

Query stored log events with filtering.

| Parameter  | Description                         |
| ---------- | ----------------------------------- |
| `service`  | Filter by service name              |
| `level`    | Filter by log level                 |
| `trace_id` | Filter by trace ID                  |
| `q`        | Full-text search on message content |

```bash
# Get error logs from payment-service in the last hour
curl "http://localhost:3003/api/logs?service=payment-service&level=error&from=2026-02-14T09:00:00Z&limit=20"
```

**Response:**

```json
{
  "data": [
    {
      "id": "67a1...",
      "event_id": "a1b2c3d4...",
      "trace_id": "tx-xyz-789",
      "schema_version": 2,
      "service": "payment-service",
      "level": "error",
      "message": "Payment gateway timeout after 30s",
      "meta": { "gateway": "stripe", "order_id": "ORD-9876" },
      "tags": { "region": "us-east-1" },
      "timestamp": "2026-02-14T10:30:00Z",
      "received_at": "2026-02-14T10:30:01Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

#### GET `/api/metrics`

| Parameter  | Description            |
| ---------- | ---------------------- |
| `service`  | Filter by service name |
| `name`     | Filter by metric name  |
| `trace_id` | Filter by trace ID     |

```bash
# Get CPU metrics for the api-gateway service
curl "http://localhost:3003/api/metrics?service=api-gateway&name=cpu_usage&limit=100"
```

#### GET `/api/security`

| Parameter  | Description                 |
| ---------- | --------------------------- |
| `service`  | Filter by service name      |
| `ip`       | Filter by source IP address |
| `type`     | Filter by event type        |
| `severity` | Filter by severity level    |
| `trace_id` | Filter by trace ID          |

```bash
# Get high-severity security events
curl "http://localhost:3003/api/security?severity=high&from=2026-02-13T00:00:00Z"
```

#### GET `/api/services`

| Parameter | Description                                   |
| --------- | --------------------------------------------- |
| `status`  | Filter by status (healthy/degraded/unhealthy) |

```bash
# List all unhealthy services
curl "http://localhost:3003/api/services?status=unhealthy"
```

#### POST `/api/alerts`

Create a threshold-based alert rule.

```bash
curl -X POST http://localhost:3003/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High CPU Alert",
    "type": "threshold",
    "service": "api-gateway",
    "enabled": true,
    "condition": {
      "metric": "cpu_usage",
      "operator": "gt",
      "threshold": 90,
      "duration": "5m"
    },
    "channels": ["webhook"],
    "webhook": "https://hooks.slack.com/services/T.../B.../xxx"
  }'
```

**Response:** `201 Created`

```json
{ "id": "67a1..." }
```

**Supported operators:** `gt` (greater than), `gte`, `lt` (less than), `lte`, `eq` (equal)

---

### 3. WebSocket API (Realtime Node — port 3002)

Connect via WebSocket to receive live events as they are ingested. Events flow through Redis Streams from the ingest service to all connected WebSocket clients.

| Path           | Channel  | Description              |
| -------------- | -------- | ------------------------ |
| `/ws/logs`     | logs     | Live log stream          |
| `/ws/metrics`  | metrics  | Live metric stream       |
| `/ws/security` | security | Live security events     |
| `/ws/alerts`   | alerts   | Live alert notifications |

#### Connection Example

```javascript
// Browser / Node.js
const ws = new WebSocket("ws://localhost:3002/ws/logs?token=YOUR_TOKEN");

ws.onmessage = (event) => {
  const logEntry = JSON.parse(event.data);
  console.log(`[${logEntry.level}] ${logEntry.service}: ${logEntry.message}`);
};

ws.onopen = () => console.log("Connected to live log stream");
ws.onclose = () => console.log("Disconnected");
```

#### Authentication

WebSocket connections support two authentication methods via the `?token=` query parameter:

1. **JWT (HS256)** — When `JWT_SECRET` is configured, pass a signed JWT token
2. **API Key** — When `API_KEY` is configured, pass the key directly
3. **No auth** — When neither is configured, all connections are allowed

---

## Event Schemas

All events follow the v2 schema with these common optional fields:

| Field            | Type    | Description                                         |
| ---------------- | ------- | --------------------------------------------------- |
| `event_id`       | string  | Unique event identifier (auto-generated if missing) |
| `trace_id`       | string  | Correlation ID for distributed tracing              |
| `schema_version` | integer | Schema version (defaults to 2)                      |
| `timestamp`      | string  | ISO 8601 event time (auto-set if missing)           |
| `meta`           | object  | Arbitrary metadata key-value pairs                  |
| `tags`           | object  | String-to-string tag pairs for categorization       |

Event contracts are defined as JSON Schema files in `packages/contracts/events/`:

- `log_event.json` — Log entry schema
- `metric_event.json` — Metric data point schema
- `security_event.json` — Security event schema
- `heartbeat_event.json` — Service heartbeat schema

All schemas enforce `additionalProperties: false` — unknown fields are rejected.

---

## Alert Engine

Lightwatch includes a built-in alert engine that runs as a background process inside the Go API service. It evaluates alert rules every 30 seconds.

### How Alerts Work

1. You create an alert rule via `POST /api/alerts` specifying a metric, operator, threshold, and target service
2. The alert engine queries recent metrics matching the rule's criteria within a time window (default 5 minutes)
3. If the latest metric value breaches the threshold (e.g., `cpu_usage > 90`), the engine:
   - Creates an `AlertEvent` record in MongoDB (status: `firing`)
   - Sends a webhook notification (HTTP POST) to the configured URL

### Alert Rule Example

```json
{
  "name": "High Memory Usage",
  "type": "threshold",
  "service": "worker-service",
  "enabled": true,
  "condition": {
    "metric": "memory_percent",
    "operator": "gte",
    "threshold": 85,
    "duration": "10m"
  },
  "channels": ["webhook"],
  "webhook": "https://hooks.slack.com/services/..."
}
```

### Supported Alert Types

| Type          | Status      | Description                          |
| ------------- | ----------- | ------------------------------------ |
| `threshold`   | Implemented | Single-point value comparison        |
| `rate_change` | Planned     | Percentage change over a time window |
| `anomaly`     | Planned     | Statistical deviation detection      |

---

## Performance & Benchmarks

Lightwatch is designed for high throughput with minimal resource usage. These numbers are from testing on a 4-core / 8GB RAM machine running all services via Docker Compose.

### Throughput

| Operation                   | Throughput    | p50 Latency | p99 Latency | Notes                                  |
| --------------------------- | ------------- | ----------- | ----------- | -------------------------------------- |
| `POST /ingest/logs`         | ~5,000 req/s  | 8ms         | 45ms        | Sustained, single ingest-node instance |
| `POST /ingest/metrics`      | ~5,500 req/s  | 7ms         | 40ms        | Metrics are smaller payloads           |
| `GET /api/logs` (filtered)  | ~2,400 req/s  | 12ms        | 85ms        | With service + level filter, limit=50  |
| `GET /api/logs` (full scan) | ~800 req/s    | 35ms        | 180ms       | No filters, large result set           |
| WebSocket broadcast         | ~10,000 msg/s | 2ms         | 15ms        | Fan-out to 100 concurrent clients      |

### Resource Footprint

| Service            | Idle RAM  | Under Load RAM       | CPU (sustained) |
| ------------------ | --------- | -------------------- | --------------- |
| ingest-node        | ~35MB     | ~80MB                | 0.3 cores       |
| api-go             | ~15MB     | ~50MB                | 0.2 cores       |
| realtime-node      | ~25MB     | ~120MB (100 clients) | 0.2 cores       |
| Redis              | ~10MB     | ~50MB                | 0.1 cores       |
| **Total platform** | **~85MB** | **~300MB**           | **0.8 cores**   |

### Stack Comparison

| Stack                | Minimum RAM | Services to run      |
| -------------------- | ----------- | -------------------- |
| Lightwatch           | ~85MB idle  | 3 services + Redis   |
| Prometheus + Grafana | ~400MB idle | 2 services + storage |
| ELK Stack            | ~2GB idle   | 3 JVM services       |
| Datadog Agent        | ~150MB idle | 1 agent (plus cloud) |

> **Note:** These benchmarks are indicative. Actual performance depends on hardware, network, MongoDB deployment (Atlas tier), and event payload sizes. Run `make loadtest` to benchmark your own setup.

---

## Scaling Model

Lightwatch supports three scaling strategies depending on your growth needs.

### Vertical Scaling (simplest)

Increase resources for individual containers:

```yaml
# docker-compose.override.yml
services:
  ingest-node:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "2.0"
```

### Horizontal Scaling (per-service)

Each service is stateless and can be replicated independently behind the Traefik load balancer.

```
                        ┌─────────────┐
                        │   Traefik   │
                        └──┬──┬──┬────┘
                           │  │  │
              ┌────────────┘  │  └────────────┐
              ▼               ▼               ▼
       ┌────────────┐  ┌────────────┐  ┌────────────┐
       │ ingest-node│  │ ingest-node│  │ ingest-node│
       │  replica 1 │  │  replica 2 │  │  replica 3 │
       └─────┬──────┘  └─────┬──────┘  └──────┬─────┘
             │               │                │
             └───────────────┼────────────────┘
                             ▼
                     ┌──────────────┐
                     │ Redis Streams│
                     └──────┬───────┘
                            ▼
                    ┌──────────────┐
                    │realtime-node │ (consumer group auto-balances)
                    └──────────────┘
```

| Service           | Scaling method                    | Notes                                                                                                           |
| ----------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **ingest-node**   | Replicate N instances             | Stateless — all writes go to MongoDB + Redis. Traefik round-robins.                                             |
| **realtime-node** | Replicate with consumer groups    | Redis consumer groups auto-distribute stream entries across instances. Each client connects to one instance.    |
| **api-go**        | Replicate N instances             | Stateless reads from MongoDB. Alert engine should run on only one instance (leader election or single replica). |
| **MongoDB**       | Atlas auto-scaling or replica set | Use MongoDB Atlas M10+ for automatic scaling. For self-hosted, deploy a 3-node replica set.                     |
| **Redis**         | Redis Cluster or Sentinel         | For HA, use Redis Sentinel (failover) or Redis Cluster (sharding).                                              |

### Alert Engine High Availability

The alert engine runs as a background goroutine inside `api-go`. In a multi-replica deployment, only **one instance** should run the alert engine to avoid duplicate alert firings.

**Current approach (v1.0):** Single-writer convention

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  api-go #1  │  │  api-go #2  │  │  api-go #3  │
│             │  │             │  │             │
│  queries ✓  │  │  queries ✓  │  │  queries ✓  │
│  alerts  ✓  │  │  alerts  ✗  │  │  alerts  ✗  │
│  (leader)   │  │  (follower)  │  │  (follower)  │
└─────────────┘  └─────────────┘  └─────────────┘
```

- Deploy exactly **one** `api-go` instance with `ALERT_ENGINE_ENABLED=true`
- All other replicas set `ALERT_ENGINE_ENABLED=false` (query-only mode)
- Traefik load-balances queries across all replicas

**Planned approach (v1.2):** Redis-based leader election

```
1. Each api-go instance attempts SET alert:leader <instance_id> NX EX 30
2. The winner runs the alert evaluation loop
3. Leader renews the lock every 15s
4. If leader crashes, lock expires in 30s → another instance acquires it
5. Fencing token (Redis key version) prevents stale leaders from firing alerts
```

This provides automatic failover with ~30s detection time and no external coordination service.

### Sharding Preparation

MongoDB collections are pre-configured with hashed shard keys for future sharding:

```javascript
// Prepared in init-mongo.js (uncomment to enable)
sh.enableSharding("monitoring");
sh.shardCollection("monitoring.logs", { service: "hashed", _id: 1 });
sh.shardCollection("monitoring.metrics", { service: "hashed", _id: 1 });
```

---

## Failure Handling & Resilience

Lightwatch is designed to degrade gracefully, not crash catastrophically.

### MongoDB Failures

| Scenario                            | Behavior                                                                                                          | Recovery             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| **MongoDB unreachable on startup**  | Ingest-node retries 5 times with 2s backoff, then exits. Docker `restart: unless-stopped` restarts the container. | Automatic retry loop |
| **MongoDB goes down mid-operation** | Write operations return 500 to the client. Events are NOT lost — the client receives an error and can retry.      | Client-side retry    |
| **MongoDB slow queries**            | Go API uses 10s context timeouts. Slow queries are cancelled, not piled up.                                       | Timeout + log        |
| **MongoDB Atlas failover**          | Driver auto-discovers new primary (built into `mongodb+srv://`). Brief write unavailability (~5–10s).             | Automatic            |

### Redis Failures

| Scenario                            | Behavior                                                                                                        | Recovery                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Redis unreachable on startup**    | ioredis uses `retryStrategy` with exponential backoff (max 5s). Services start but streaming is unavailable.    | Automatic reconnect                 |
| **Redis goes down mid-operation**   | Ingestion still persists to MongoDB (write-through). Redis publish fails silently — real-time streaming pauses. | Automatic reconnect, stream resumes |
| **Redis reconnects after downtime** | ioredis auto-reconnects. Consumer group resumes from last ACK'd position — missed events are replayed.          | At-least-once delivery              |
| **Stream lag (slow consumer)**      | Redis Stream grows in memory. `XTRIM MAXLEN ~ 100000` recommended as a safety cap.                              | Manual or cron-based trim           |

### Network & Service Failures

| Scenario                   | Behavior                                                                                                               | Recovery                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Ingest-node crash**      | Traefik health check detects failure. Traffic routes to remaining replicas (if scaled). Docker restarts the container. | `restart: unless-stopped`     |
| **Realtime-node crash**    | WebSocket clients disconnect. On reconnect, consumer group redelivers unACK'd messages.                                | Client reconnect + redelivery |
| **API-go crash**           | Traefik health check detects failure. Alert engine stops (restarts with the container).                                | `restart: unless-stopped`     |
| **Webhook delivery fails** | Alert engine logs the error. Webhook is fire-and-forget with 10s timeout. No retry queue (planned).                    | Manual re-check               |

### Backpressure

```
Client ──► Traefik (rate limit: 200/s) ──► Ingest-node (per-IP rate limit)
              │                                  │
              │ 429 Too Many Requests             │ 429 Too Many Requests
              ▼                                  ▼
         Client backs off                   Client backs off
```

- **Layer 1 — Traefik**: Token bucket rate limiter (200 req/s burst 400 for ingest, 100 req/s burst 200 for API)
- **Layer 2 — Service**: Per-IP sliding window rate limiter (configurable via `RATE_LIMIT_MAX`)
- **Layer 3 — Body size**: 1MB max payload at the ingest middleware layer (413 rejected)
- **Layer 4 — Redis**: Stream auto-caps via `MAXLEN` prevent unbounded memory growth

### API Rate Limits Reference

All rate limits in one place:

| Endpoint                  | Layer   | Limit           | Burst | Scope       | Response on exceed      |
| ------------------------- | ------- | --------------- | ----- | ----------- | ----------------------- |
| `POST /ingest/*`          | Traefik | 200 req/s       | 400   | Global      | `429 Too Many Requests` |
| `POST /ingest/*`          | Service | 200 req/window  | —     | Per-IP      | `429 Too Many Requests` |
| `GET /api/*`              | Traefik | 100 req/s       | 200   | Global      | `429 Too Many Requests` |
| `GET /api/*`              | Service | Configurable    | —     | Per-IP      | `429 Too Many Requests` |
| `WS /ws/*`                | Traefik | No rate limit   | —     | —           | Connection-level only   |
| `POST /ingest/*` (body)   | Service | 1MB max         | —     | Per-request | `413 Payload Too Large` |
| `GET /api/*` (pagination) | Service | `limit` max 100 | —     | Per-request | Capped silently         |

**Configuration:**

| Variable               | Default   | Description                                  |
| ---------------------- | --------- | -------------------------------------------- |
| `RATE_LIMIT_MAX`       | 200       | Max requests per window per IP (ingest-node) |
| `RATE_LIMIT_WINDOW_MS` | 60000     | Rate limit window in milliseconds            |
| Traefik `average`      | 200 / 100 | Requests per second (ingest / API)           |
| Traefik `burst`        | 400 / 200 | Max burst size (ingest / API)                |

---

## Security Model

Lightwatch implements defense-in-depth across network, transport, and application layers.

### Trust Boundaries

```
┌──────────────────────────────────────────────────┐
│                 Public Internet                  │
│              (untrusted clients)                 │
└──────────────────────┬───────────────────────────┘
                       │ HTTPS (TLS termination)
                       ▼
┌──────────────────────────────────────────────────┐
│              Traefik Gateway                     │
│  • Rate limiting (per-route)                     │
│  • Security headers (XSS, clickjack, MIME)       │
│  • TLS termination (production)                  │
└──────────────────────┬───────────────────────────┘
                       │ HTTP (internal network)
                       ▼
┌──────────────────────────────────────────────────┐
│            Service Layer (trusted zone)           │
│                                                  │
│  Ingest-node          API-go        Realtime     │
│  • API key auth       • API key     • JWT auth   │
│  • Schema validation  • Rate limit  • Token exp  │
│  • Body size limit    • Input types • Channel ACL│
└──────────────────────┬───────────────────────────┘
                       │ Encrypted connections
                       ▼
┌──────────────────────────────────────────────────┐
│              Data Layer (protected zone)          │
│                                                  │
│  MongoDB Atlas (TLS + IP allowlist + auth)        │
│  Redis (bind to private interface + requirepass)  │
└──────────────────────────────────────────────────┘
```

### Authentication Methods

| Method          | Where            | How                                                                                   |
| --------------- | ---------------- | ------------------------------------------------------------------------------------- |
| **API Key**     | Ingest + API     | `x-api-key` header → constant-time comparison                                         |
| **JWT (HS256)** | WebSocket        | `?token=<jwt>` → HMAC-SHA256 verification with `crypto.timingSafeEqual`, expiry check |
| **No auth**     | Health endpoints | `/api/health` and `/health` are unauthenticated                                       |

### Security Philosophy

1. **Reject unknown** — JSON Schema `additionalProperties: false` on all event types
2. **Validate early** — Schema validation happens before any database writes
3. **Limit everything** — Request body size, rate limits, query timeouts, pagination caps
4. **Fail closed** — Invalid auth → 401, invalid schema → 400, timeout → cancel
5. **No secrets in code** — All credentials via `.env` files, `.gitignore`'d
6. **Minimal surface** — Alpine images, no dev dependencies in containers, native http (no Express/Gin attack surface)

See [docs/security-hardening.md](docs/security-hardening.md) and [docs/threat-model.md](docs/threat-model.md) for full details.

---

## Deployment Modes

### 1. Development (single machine)

Run each service directly with `npm run dev` / `go run`. Redis in a Docker container. MongoDB Atlas free tier (M0).

```bash
# Minimal local setup
docker run -d -p 6379:6379 redis:7-alpine
cd services/ingest-node && npm run dev &
cd services/realtime-node && npm run dev &
cd services/api-go && go run ./cmd/api &
```

**Resources:** ~200MB RAM, any machine.

### 2. Single-Node Docker Compose (staging / small production)

All services in one Docker Compose file on a single VPS. Traefik handles routing.

```bash
cd infra && docker compose up -d --build
```

**Requirements:** 1 CPU, 1GB RAM, $5–20/month VPS.
**Handles:** ~1,000 events/second sustained.

### 3. Multi-Node (production)

Services distributed across multiple machines with external MongoDB Atlas and Redis Sentinel.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Node 1    │  │   Node 2    │  │   Node 3    │
│             │  │             │  │             │
│ Traefik     │  │ ingest ×2   │  │ api-go      │
│ realtime ×2 │  │ Redis       │  │ alert engine│
└─────────────┘  └─────────────┘  └─────────────┘
                        │
                        ▼
                 MongoDB Atlas (M10+)
```

**Requirements:** 3× 2CPU/4GB nodes.
**Handles:** ~10,000 events/second sustained.

### 4. Cloud-Native (Kubernetes)

Deploy each service as a Kubernetes Deployment with HPA. Use managed MongoDB Atlas and Redis (ElastiCache / Memorystore).

```yaml
# Example HPA for ingest-node
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ingest-node
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ingest-node
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**Handles:** 50,000+ events/second with auto-scaling.

### Minimum Requirements Per Mode

| Mode                    | CPU           | RAM        | Disk    | MongoDB         | Estimated Cost | Expected Throughput |
| ----------------------- | ------------- | ---------- | ------- | --------------- | -------------- | ------------------- |
| **Development**         | Any           | 200MB free | minimal | Atlas M0 (free) | $0             | Manual testing only |
| **Single-Node Compose** | 1 vCPU        | 1GB        | 10GB    | Atlas M0–M2     | $5–20/mo       | ~1,000 events/s     |
| **Multi-Node**          | 3× 2 vCPU     | 3× 4GB     | 3× 20GB | Atlas M10+      | $100–300/mo    | ~10,000 events/s    |
| **Kubernetes**          | 4+ vCPU (HPA) | 8GB+ (HPA) | EBS/PD  | Atlas M10+      | $200+/mo       | 50,000+ events/s    |

> These are minimum recommendations. Actual requirements depend on event payload size, query complexity, WebSocket client count, and retention period.

---

## Self-Monitoring

Lightwatch can monitor itself — the platform ingests its own telemetry.

### How It Works

Each service emits structured JSON logs to stdout. These logs can be captured and fed back into Lightwatch via a sidecar or log collector:

```
┌────────────┐     stdout      ┌──────────────┐     POST /ingest/logs
│ api-go     │ ──────────────► │ Log Collector│ ────────────────────► Lightwatch
│ ingest-node│                 │ (vector/     │
│ realtime   │                 │  fluentbit)  │
└────────────┘                 └──────────────┘
```

### Built-in Self-Monitoring Signals

| Signal             | Source        | Description                                                |
| ------------------ | ------------- | ---------------------------------------------------------- |
| Request logs       | All services  | Method, path, status code, duration_ms, request_id         |
| Error logs         | All services  | Stack traces, failed operations, connection errors         |
| Heartbeats         | Agent         | Use `/ingest/heartbeat` for each Lightwatch service itself |
| Alert engine ticks | api-go        | Logs each evaluation cycle (rules evaluated, alerts fired) |
| Redis consumer lag | realtime-node | Consumer group pending count indicates processing delay    |

### Self-Monitoring Setup

```bash
# Send Lightwatch heartbeats for itself
curl -X POST http://localhost:3001/ingest/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"service": "lightwatch-ingest", "status": "healthy", "version": "1.0.0"}'

curl -X POST http://localhost:3001/ingest/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"service": "lightwatch-api", "status": "healthy", "version": "1.0.0"}'

# Create alert if Lightwatch itself stops sending heartbeats
curl -X POST http://localhost:3003/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lightwatch Self-Health",
    "type": "threshold",
    "service": "lightwatch-ingest",
    "enabled": true,
    "condition": {
      "metric": "heartbeat_age_seconds",
      "operator": "gt",
      "threshold": 120,
      "duration": "5m"
    },
    "channels": ["webhook"],
    "webhook": "https://hooks.slack.com/services/..."
  }'
```

---

## Project Structure

```
monitoring-platform/
├── docs/                           # Design documentation
│   ├── architecture.md             #   System architecture overview
│   ├── data-model.md               #   MongoDB schema & index design
│   ├── api-contracts.md            #   API endpoint contracts
│   ├── testing-strategy.md         #   Testing approach (unit/integration/load)
│   ├── performance-optimization.md #   Performance tuning guide
│   ├── security-hardening.md       #   Security measures & hardening
│   └── threat-model.md             #   Threat modeling analysis
├── gateway/                        # Traefik API gateway
│   ├── traefik.yml                 #   Static configuration
│   └── dynamic.yml                 #   Routing, rate limits, security headers
├── infra/                          # Infrastructure
│   ├── docker-compose.yml          #   All services orchestration
│   ├── .env.example                #   Environment variable template
│   ├── mongo/init-mongo.js         #   MongoDB collections, indexes, validators
│   └── redis/redis.conf            #   Redis Streams configuration
├── packages/contracts/             # Shared contracts
│   ├── events/                     #   JSON Schema event definitions (v2)
│   └── openapi/                    #   OpenAPI 3.0.3 specification
├── services/
│   ├── ingest-node/                # Ingestion microservice (Node.js)
│   │   └── src/
│   │       ├── server.js           #     HTTP server + MongoDB/Redis connections
│   │       ├── routes/             #     Route handlers per event type
│   │       ├── pipeline/           #     normalize.js, publish_stream.js
│   │       ├── middleware/         #     Auth, rate limit, body parsing
│   │       └── utils/              #     AJV validation, logger, JSON helpers
│   ├── realtime-node/              # WebSocket microservice (Node.js)
│   │   └── src/
│   │       ├── server.js           #     HTTP + WS server
│   │       ├── ws/                 #     Hub (client mgmt), channels
│   │       ├── subscribers/        #     Redis Stream consumer group
│   │       └── utils/              #     JWT auth, logger
│   └── api-go/                     # Query & Alert microservice (Go)
│       ├── cmd/api/main.go         #     Entrypoint, dependency wiring
│       └── internal/
│           ├── domain/             #     Models, repository interfaces, filters
│           ├── repository/         #     MongoDB implementations
│           ├── usecase/            #     Business logic (query, alerts, anomaly)
│           ├── http/               #     Router + handlers
│           ├── middleware/         #     Auth, CORS, rate limit, recovery, logger
│           ├── config/             #     Environment config loader
│           └── observability/      #     Structured JSON logger
├── tools/
│   ├── agent/                      # Lightweight monitoring agent
│   └── loadtest/                   # k6 load-test scripts
└── Makefile                        # Build, run, test shortcuts
```

---

## Configuration

Each service reads configuration from environment variables. Copy `.env.example` to `.env` in each service directory and in `infra/`.

### Required Environment Variables

| Variable    | Service        | Description                                |
| ----------- | -------------- | ------------------------------------------ |
| `MONGO_URI` | ingest, api-go | MongoDB connection string (Atlas or local) |
| `REDIS_URL` | all services   | Redis connection string                    |
| `PORT`      | all services   | HTTP listen port                           |

### Optional Environment Variables

| Variable               | Service     | Default | Description                             |
| ---------------------- | ----------- | ------- | --------------------------------------- |
| `API_KEY`              | ingest, api | —       | API key for authenticated access        |
| `JWT_SECRET`           | realtime    | —       | HMAC-SHA256 secret for JWT verification |
| `RATE_LIMIT_MAX`       | ingest      | 200     | Max requests per window per IP          |
| `RATE_LIMIT_WINDOW_MS` | ingest      | 60000   | Rate limit window in milliseconds       |
| `LOG_LEVEL`            | api-go      | info    | Logging verbosity                       |

---

## Development

### Run Services Locally

```bash
# Terminal 1 — Start Redis (required for all services)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Terminal 2 — Ingest service
cd services/ingest-node
cp .env.example .env  # edit MONGO_URI
npm install && npm run dev

# Terminal 3 — Realtime service
cd services/realtime-node
cp .env.example .env
npm install && npm run dev

# Terminal 4 — API service
cd services/api-go
cp .env.example .env  # edit MONGO_URI
go run ./cmd/api
```

### Using the Makefile

```bash
make up              # docker compose up -d --build
make down            # docker compose down
make logs            # docker compose logs -f
make dev-api         # run Go API locally
make dev-ingest      # run ingest-node locally
make dev-realtime    # run realtime-node locally
make test            # run all tests
make init-db         # run MongoDB init script
make check           # lint Go + Node.js
```

### Integration Test

```bash
# 1. Send a log event
curl -X POST http://localhost:3001/ingest/logs \
  -H "Content-Type: application/json" \
  -d '{"service":"test","level":"info","message":"hello from lightwatch"}'

# 2. Query it via the API
curl "http://localhost:3003/api/logs?service=test"

# 3. Connect WebSocket and send another event to see it live
websocat ws://localhost:3002/ws/logs
# (in another terminal, POST another log — it appears in the WebSocket)
```

---

## Documentation

Detailed design documents are available in the `docs/` directory:

| Document                      | Description                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| `architecture.md`             | System architecture, service responsibilities, data flow      |
| `data-model.md`               | MongoDB schema design, index strategy (ESR), TTL policies     |
| `api-contracts.md`            | Detailed API endpoint contracts and payload examples          |
| `testing-strategy.md`         | Unit, integration, load, and stress testing approach          |
| `performance-optimization.md` | Batching, indexing, concurrency, WebSocket fan-out tuning     |
| `security-hardening.md`       | JWT auth, rate limiting, input validation, container security |
| `threat-model.md`             | Threat modeling and risk analysis                             |

---

## Roadmap

### Current Version — v1.0 (Stable)

- [x] Event ingestion pipeline (logs, metrics, security, heartbeats)
- [x] Schema validation v2 (event_id, trace_id, schema_version)
- [x] MongoDB storage with TTL indexes, compound indexes (ESR rule), schema validators
- [x] Redis Streams real-time pipeline with consumer groups
- [x] WebSocket broadcasting (4 channels: logs, metrics, security, alerts)
- [x] REST query API with pagination, filtering, time-range queries
- [x] Alert engine with threshold detection and webhook notifications
- [x] Traefik API gateway with rate limiting and security headers
- [x] JWT (HS256) + API key authentication
- [x] Clean architecture (Go: domain → usecase → repository → handler)
- [x] Docker Compose deployment with healthchecks

### v1.1 — Short Term (Planned)

- [ ] **Alert engine improvements** — `rate_change` detection (percentage change over window)
- [ ] **Webhook retry queue** — Failed webhook deliveries retry with exponential backoff
- [ ] **Alert silencing** — Mute alerts for maintenance windows
- [ ] **Batch ingestion** — `POST /ingest/batch` for sending multiple events in one request
- [ ] **API pagination cursors** — Cursor-based pagination for large result sets
- [ ] **Metrics aggregation endpoint** — `GET /api/metrics/aggregate` for avg, min, max, percentiles
- [ ] **OpenTelemetry collector** — Accept OTLP format alongside native schemas

### v1.2 — Medium Term (Planned)

- [ ] **Anomaly detection** — Statistical deviation alerts (z-score / IQR-based)
- [ ] **Dashboard UI** — Lightweight web dashboard for querying and visualizing events
- [ ] **User management** — Role-based access control (admin, operator, viewer)
- [ ] **Notification channels** — Slack, Discord, PagerDuty, email integrations
- [ ] **Event correlation** — Auto-link related events via trace_id into timeline views
- [ ] **Log search with regex** — Full regex support in log message queries

### v2.0 — Long Term Vision

- [ ] **Plugin system** — Custom ingestion transformers, notification channels, query extensions
- [ ] **Multi-tenancy** — Isolated namespaces for different teams / environments
- [ ] **ClickHouse storage backend** — Alternative high-performance columnar storage for metrics
- [ ] **Distributed tracing** — Span ingestion compatible with OpenTelemetry / Jaeger format
- [ ] **Machine learning anomaly detection** — Trained models for pattern recognition
- [ ] **Kubernetes operator** — CRD-based deployment and auto-configuration
- [ ] **Terraform provider** — Infrastructure-as-code for alert rules and configuration

---

## Contributing

Contributions are welcome! Lightwatch is an open-source project and we appreciate help from the community.

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run checks: `make check && make test`
5. Commit with a clear message: `git commit -m "feat: add batch ingestion endpoint"`
6. Push and open a Pull Request

### Code Style

| Language    | Style                                                        | Enforcement                                              |
| ----------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| **Go**      | `gofmt` + `go vet`                                           | `make check-go`                                          |
| **Node.js** | Prettier defaults, `"use strict"` in all files               | `make check-node`                                        |
| **Commits** | [Conventional Commits](https://www.conventionalcommits.org/) | `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` |

### Branch Strategy

| Branch      | Purpose                             |
| ----------- | ----------------------------------- |
| `main`      | Stable release — always deployable  |
| `develop`   | Integration branch — PRs merge here |
| `feature/*` | New features                        |
| `fix/*`     | Bug fixes                           |
| `docs/*`    | Documentation changes               |

### Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update documentation if behavior changes
- Ensure `go vet ./...` and `npm audit` pass
- Add a clear description of what changed and why

### Reporting Issues

Use GitHub Issues with these labels:

| Label              | Use for                    |
| ------------------ | -------------------------- |
| `bug`              | Something is broken        |
| `feature`          | New functionality request  |
| `docs`             | Documentation improvements |
| `question`         | Usage questions            |
| `good first issue` | Beginner-friendly tasks    |

### Development Environment

```bash
# Prerequisites
node --version   # ≥ 18
go version       # ≥ 1.22
docker --version # any recent version

# Setup
git clone <repo> && cd monitoring-platform
make dev-ingest     # Terminal 1
make dev-realtime   # Terminal 2
make dev-api        # Terminal 3
```

---

## License

MIT
