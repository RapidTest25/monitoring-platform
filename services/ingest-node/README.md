# Lightwatch – Ingest Service

Ingestion microservice built with **Node.js native `http` module** (no Express).

## Responsibilities

- Accept HTTP POST payloads for metrics, logs, security events, and heartbeats
- Validate payloads against JSON schemas (AJV)
- Normalize data to canonical format
- Persist events to MongoDB
- Publish events to Redis Streams for downstream consumers

## Stack

| Concern     | Implementation                |
| ----------- | ----------------------------- |
| HTTP server | Node.js `http.createServer()` |
| Validation  | AJV + ajv-formats             |
| Database    | MongoDB via `mongodb` driver  |
| Streaming   | Redis Streams via `ioredis`   |

## Endpoints

| Method | Path                | Description             |
| ------ | ------------------- | ----------------------- |
| POST   | `/ingest/metrics`   | Push metric data points |
| POST   | `/ingest/logs`      | Push structured logs    |
| POST   | `/ingest/security`  | Push security events    |
| POST   | `/ingest/heartbeat` | Agent heartbeat         |
| GET    | `/health`           | Health check            |

## Running

```bash
npm install
npm run dev    # uses --watch
npm start      # production
```

## Environment Variables

| Variable    | Default                                | Description               |
| ----------- | -------------------------------------- | ------------------------- |
| `PORT`      | `3001`                                 | HTTP listen port          |
| `MONGO_URI` | `mongodb://localhost:27017/monitoring` | MongoDB connection string |
| `REDIS_URL` | `redis://localhost:6379`               | Redis connection string   |
| `API_KEY`   | _(empty)_                              | Optional API key for auth |
