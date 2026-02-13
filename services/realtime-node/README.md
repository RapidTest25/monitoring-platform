# Lightwatch – Realtime Service

WebSocket microservice built with **Node.js native `http`** + **`ws`** library.

## Responsibilities

- Subscribe to Redis Streams (`stream:logs`, `stream:alerts`)
- Maintain WebSocket connections with clients
- Broadcast matching events to subscribed channels

## Stack

| Concern     | Implementation                              |
| ----------- | ------------------------------------------- |
| HTTP server | Node.js `http.createServer()`               |
| WebSocket   | `ws` library (no Socket.IO)                 |
| Streaming   | Redis Streams via `ioredis` consumer groups |

## Channels

| Protocol | Path         | Description       |
| -------- | ------------ | ----------------- |
| WS       | `/ws/logs`   | Live log stream   |
| WS       | `/ws/alerts` | Live alert stream |

## Running

```bash
npm install
npm run dev    # uses --watch
npm start      # production
```

## Environment Variables

| Variable    | Default                  | Description                   |
| ----------- | ------------------------ | ----------------------------- |
| `PORT`      | `3002`                   | HTTP listen port              |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string       |
| `WS_TOKEN`  | _(empty)_                | Optional WebSocket auth token |
