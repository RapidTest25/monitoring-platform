# Lightwatch – API Service

Query and management microservice built with **Go standard `net/http`** (no external routers).

## Responsibilities

- Serve read-only query endpoints against MongoDB
- Support filtering, pagination, and time-range queries
- Manage alert rule CRUD
- Run anomaly detection (stub)

## Stack

| Concern     | Implementation                                                       |
| ----------- | -------------------------------------------------------------------- |
| HTTP server | Go `net/http` + `http.ServeMux`                                      |
| Routing     | Go 1.22 method-based patterns (`"GET /api/..."`)                     |
| Database    | MongoDB via `go.mongodb.org/mongo-driver`                            |
| Middleware  | Custom chain (CORS, recovery, logging, request ID, auth, rate limit) |
| Logging     | Structured JSON via `internal/observability`                         |

## Endpoints

| Method | Path                   | Description           |
| ------ | ---------------------- | --------------------- |
| GET    | `/api/health`          | Health check          |
| GET    | `/api/services`        | List known services   |
| GET    | `/api/logs`            | Query logs            |
| GET    | `/api/metrics`         | Query metrics         |
| GET    | `/api/security/events` | Query security events |
| POST   | `/api/alerts`          | Create alert rule     |
| GET    | `/api/alerts`          | List alert rules      |

## Running

```bash
go run ./cmd/api
```

## Environment Variables

| Variable    | Default                                | Description                          |
| ----------- | -------------------------------------- | ------------------------------------ |
| `PORT`      | `3003`                                 | HTTP listen port                     |
| `MONGO_URI` | `mongodb://localhost:27017/monitoring` | MongoDB connection string            |
| `REDIS_URL` | `redis://localhost:6379`               | Redis connection string              |
| `API_KEY`   | _(empty)_                              | Optional API key for auth            |
| `LOG_LEVEL` | `info`                                 | Log level (debug, info, warn, error) |
