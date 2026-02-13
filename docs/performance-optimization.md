# Lightwatch — Performance Optimization Strategy

## Overview

This document outlines performance optimization techniques applied across
the Lightwatch monitoring platform, covering ingestion throughput,
query performance, WebSocket fan-out, and resource efficiency.

---

## 1. Ingestion Pipeline

### Batch Writing

The ingest-node service supports single-event ingestion. Future optimization:

```javascript
// Accumulate events in a buffer, flush every 100ms or 500 events
const buffer = [];
const FLUSH_INTERVAL = 100; // ms
const FLUSH_SIZE = 500;

function addEvent(event) {
  buffer.push(event);
  if (buffer.length >= FLUSH_SIZE) flush();
}

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0);
  await db.collection("logs").insertMany(batch, { ordered: false });
  for (const event of batch) {
    await redis.xadd("stream:logs", "*", "data", JSON.stringify(event));
  }
}

setInterval(flush, FLUSH_INTERVAL);
```

### Redis Stream Batching

The realtime subscriber already uses `COUNT 100` in XREADGROUP for batch reads.
Additional optimizations:

- **Pipeline ACKs**: Batch XACK calls instead of per-message
- **Trim streams**: `XTRIM stream:logs MAXLEN ~ 100000` to cap memory

### Connection Pooling

- MongoDB driver uses connection pooling by default (maxPoolSize: 100)
- Redis uses a single connection per service (sufficient for Streams)

---

## 2. MongoDB Query Optimization

### Index Strategy (ESR Rule)

All compound indexes follow the **Equality → Sort → Range** pattern:

| Collection      | Index                                | Pattern |
| --------------- | ------------------------------------ | ------- |
| logs            | `{service:1, level:1, timestamp:-1}` | E-E-S   |
| logs            | `{service:1, timestamp:-1}`          | E-S     |
| metrics         | `{service:1, name:1, timestamp:-1}`  | E-E-S   |
| security_events | `{source_ip:1, timestamp:-1}`        | E-S     |
| security_events | `{type:1, severity:1, timestamp:-1}` | E-E-S   |

### Query Patterns

All repository queries:

1. Apply equality filters first (service, level, type)
2. Apply time range via `$gte`/`$lte` on timestamp
3. Sort by `timestamp: -1` (most recent first)
4. Use `skip`/`limit` for pagination

### Covered Queries

For count queries, MongoDB can answer entirely from the index without touching documents.
The `CountDocuments` call uses the same filter as `Find`, leveraging the same index.

### TTL Indexes

Automatic data lifecycle management:

| Collection      | TTL     | Field         |
| --------------- | ------- | ------------- |
| logs            | 30 days | `received_at` |
| metrics         | 30 days | `received_at` |
| security_events | 90 days | `received_at` |

---

## 3. Go API Concurrency

### Context Timeouts

Every MongoDB operation uses a 10-second context timeout:

```go
ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
defer cancel()
```

This prevents slow queries from blocking goroutines indefinitely.

### Parallel Count + Find

Currently count and find run sequentially. Future optimization using `errgroup`:

```go
import "golang.org/x/sync/errgroup"

g, gCtx := errgroup.WithContext(ctx)
var results []domain.LogEvent
var total int64

g.Go(func() error {
    var err error
    total, err = r.col.CountDocuments(gCtx, filter)
    return err
})
g.Go(func() error {
    cursor, err := r.col.Find(gCtx, filter, opts)
    if err != nil { return err }
    return cursor.All(gCtx, &results)
})
if err := g.Wait(); err != nil { return nil, 0, err }
```

### HTTP Server Tuning

```go
srv := &http.Server{
    ReadTimeout:  10 * time.Second,
    WriteTimeout: 30 * time.Second,
    IdleTimeout:  60 * time.Second,
}
```

---

## 4. WebSocket Fan-out

### Current Design

The Hub maintains a `Map<channelName, Map<clientId, WebSocket>>` structure.
Broadcast iterates all clients on a channel and sends the message.

### Optimization Strategies

1. **Message serialization once**: Serialize the payload once, send the same
   buffer to all clients (avoid per-client JSON.stringify)

2. **Backpressure handling**: Skip clients with buffered amounts > threshold:

   ```javascript
   if (ws.bufferedAmount > 64 * 1024) {
     // Client is slow, skip this message
     return;
   }
   ```

3. **Binary frames**: For high-throughput channels, use binary WebSocket
   frames with MessagePack encoding

4. **Channel partitioning**: Support service-specific sub-channels:
   `/ws/logs?service=api-go` — only receive logs from that service

---

## 5. Resource Efficiency

### Memory Management

| Service       | Strategy                                                        |
| ------------- | --------------------------------------------------------------- |
| api-go        | Go GC handles allocation; avoid large allocations in hot paths  |
| ingest-node   | Stream body parsing (1MB limit); avoid buffering entire request |
| realtime-node | Map-based client tracking; cleanup on disconnect                |
| Redis         | `maxmemory 256mb` with `allkeys-lru` eviction                   |

### Container Resources

Recommended Docker resource limits:

```yaml
# docker-compose.yml (production)
services:
  api-go:
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "1.0"
  ingest-node:
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
  realtime-node:
    deploy:
      resources:
        limits:
          memory: 512M # higher for WebSocket connections
          cpus: "1.0"
```

---

## 6. Monitoring Performance KPIs

| Metric                      | Target        | Alert Threshold |
| --------------------------- | ------------- | --------------- |
| Ingest p99 latency          | < 50ms        | > 100ms         |
| API query p99 latency       | < 100ms       | > 500ms         |
| WebSocket broadcast latency | < 10ms        | > 50ms          |
| MongoDB query time          | < 20ms        | > 100ms         |
| Redis Stream lag            | < 100 entries | > 1000 entries  |
| Memory usage per service    | < 200MB       | > 400MB         |
