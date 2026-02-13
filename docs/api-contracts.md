# API Contracts

## Ingest Service (Node.js)

### POST /ingest/metrics

**Request:**

```json
{
  "service": "web-api",
  "name": "cpu_usage",
  "value": 72.5,
  "unit": "percent",
  "tags": { "host": "srv-01" },
  "timestamp": "2026-02-14T10:00:00Z"
}
```

**Response:** `201 Created`

```json
{ "status": "accepted", "id": "65f..." }
```

### POST /ingest/logs

**Request:**

```json
{
  "service": "web-api",
  "level": "error",
  "message": "Connection refused to DB",
  "meta": { "host": "srv-01", "pid": 1234 },
  "timestamp": "2026-02-14T10:00:00Z"
}
```

**Response:** `201 Created`

```json
{ "status": "accepted", "id": "65f..." }
```

### POST /ingest/security

**Request:**

```json
{
  "service": "firewall",
  "type": "brute_force",
  "source_ip": "192.168.1.100",
  "description": "10 failed SSH attempts in 60 seconds",
  "severity": "high",
  "meta": { "port": 22 },
  "timestamp": "2026-02-14T10:00:00Z"
}
```

**Response:** `201 Created`

```json
{ "status": "accepted", "id": "65f..." }
```

### POST /ingest/heartbeat

**Request:**

```json
{
  "service": "web-api",
  "host": "srv-01",
  "meta": { "uptime": 86400, "version": "1.2.0" }
}
```

**Response:** `200 OK`

```json
{ "status": "ok", "service": "web-api" }
```

---

## API Service (Go)

### GET /api/health

**Response:** `200 OK`

```json
{ "status": "ok", "timestamp": "2026-02-14T10:00:00Z" }
```

### GET /api/services

**Response:** `200 OK`

```json
{
  "data": [
    {
      "name": "web-api",
      "host": "srv-01",
      "status": "healthy",
      "last_heartbeat": "2026-02-14T09:59:30Z"
    }
  ]
}
```

### GET /api/logs?service=web-api&level=error&q=connection&from=2026-02-14T00:00:00Z&to=2026-02-14T23:59:59Z&page=1

**Response:** `200 OK`

```json
{
  "data": [
    {
      "service": "web-api",
      "level": "error",
      "message": "...",
      "timestamp": "..."
    }
  ],
  "page": 1,
  "total": 42
}
```

### GET /api/metrics?service=web-api&from=...&to=...

**Response:** `200 OK`

```json
{
  "data": [
    {
      "service": "web-api",
      "name": "cpu_usage",
      "value": 72.5,
      "unit": "percent",
      "timestamp": "..."
    }
  ]
}
```

### GET /api/security/events?ip=192.168.1.100&type=brute_force&from=...&to=...

**Response:** `200 OK`

```json
{
  "data": [
    {
      "type": "brute_force",
      "source_ip": "192.168.1.100",
      "severity": "high",
      "timestamp": "..."
    }
  ]
}
```

### POST /api/alerts

**Request:**

```json
{
  "name": "High CPU",
  "condition": {
    "metric": "cpu_usage",
    "operator": "gt",
    "threshold": 90,
    "duration": "5m"
  },
  "service": "web-api",
  "enabled": true
}
```

**Response:** `201 Created`

```json
{ "id": "65f...", "name": "High CPU", "enabled": true }
```

### GET /api/alerts

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "65f...",
      "name": "High CPU",
      "condition": { "metric": "cpu_usage", "operator": "gt", "threshold": 90 },
      "enabled": true
    }
  ]
}
```

---

## Realtime (WebSocket)

### WS /ws/logs

Client connects → receives streaming log events:

```json
{ "service": "web-api", "level": "error", "message": "...", "timestamp": "..." }
```

### WS /ws/alerts

Client connects → receives triggered alerts:

```json
{
  "alert": "High CPU",
  "service": "web-api",
  "value": 95.2,
  "threshold": 90,
  "triggered_at": "..."
}
```

---

## Common Error Responses

```json
{ "error": "validation_error", "message": "field 'service' is required" }
```

```json
{ "error": "unauthorized", "message": "invalid or missing API key" }
```

```json
{ "error": "rate_limited", "message": "too many requests" }
```
