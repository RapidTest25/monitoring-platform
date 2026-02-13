# Lightwatch – Architecture

## High-Level Overview

```
┌──────────┐     ┌──────────────┐     ┌───────────┐
│  Agents  │────▶│  Traefik GW  │────▶│  Ingest   │──┐
│  & Apps  │     │  (port 80)   │     │  (Node)   │  │
└──────────┘     └──────┬───────┘     └───────────┘  │
                        │                             │
                        │  ┌──────────────────────┐   │
                        │  │     Redis Streams     │◀──┘
                        │  └──────────┬───────────┘
                        │             │
                        │  ┌──────────▼───────────┐
                        │  │   Realtime (Node/WS)  │
                        │  └──────────────────────┘
                        │
                 ┌──────▼───────┐     ┌───────────┐
                 │   API (Go)   │────▶│  MongoDB   │
                 └──────────────┘     └───────────┘
```

## Component Responsibilities

### Ingest Service (Node.js – native `http`)

- Uses Node.js built-in `http` module (no Express)
- Accepts HTTP POST payloads for metrics, logs, security events, and heartbeats
- Custom middleware pipeline for body parsing, auth, and rate limiting
- Normalizes incoming data to a canonical schema
- Publishes events to Redis Streams for downstream consumers
- Persists raw events to MongoDB

### Realtime Service (Node.js)

- Subscribes to Redis Streams (`stream:logs`, `stream:alerts`)
- Maintains WebSocket connections with clients
- Broadcasts matching events to subscribed channels

### API Service (Go – standard `net/http`)

- Uses Go standard library `net/http.ServeMux` (no external routers)
- Provides read-only query endpoints against MongoDB
- Supports filtering, pagination, and time-range queries
- Manages alert rule CRUD
- Custom middleware chain (CORS, recovery, logging, request ID, auth, rate limit)
- Runs a simple anomaly detection loop (optional)

### Gateway (Traefik)

- Routes `/ingest/*` → ingest-node
- Routes `/api/*` → api-go
- Routes `/ws/*` → realtime-node
- Provides rate-limiting and optional TLS termination

## Data Flow

1. **Agent / App** sends data via HTTP POST to `/ingest/*`
2. **Ingest** normalizes the payload, writes to MongoDB, publishes to Redis Stream
3. **Realtime** reads from Redis Stream, pushes to connected WebSocket clients
4. **API** serves historical queries directly from MongoDB

## Persistence

- **MongoDB** — primary store for logs, metrics, security events, alerts, services
- **Redis** — ephemeral stream for real-time fan-out; also used for rate-limit counters

## Scalability Notes

- Ingest and API are stateless; scale horizontally behind Traefik
- Realtime uses Redis consumer groups for multi-instance fan-out
- MongoDB supports sharding for large-scale deployments
