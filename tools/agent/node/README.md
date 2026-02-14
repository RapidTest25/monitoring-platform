# Lightwatch Agent (Node.js)

Zero-dependency Node.js agent that collects system metrics and pushes them to a [Lightwatch](../../../README.md) monitoring platform instance.

## Requirements

- **Node.js ≥ 18** (uses native `fetch` and `AbortSignal.timeout`)
- No additional dependencies — zero `node_modules`

## Collected Metrics

| Metric | Unit | Linux | macOS | Windows |
|---|---|---|---|---|
| `cpu_usage` | percent | ✅ | ✅ | ✅ |
| `memory_percent` | percent | ✅ | ✅ | ✅ |
| `disk_percent` | percent | ✅ | ✅ | ✅ (C: drive) |
| `load_1m` | load | ✅ | ✅ | ❌ (not available) |
| `net_rx_bytes_per_sec` | bytes/s | ✅ | ✅ | ❌ |
| `net_tx_bytes_per_sec` | bytes/s | ✅ | ✅ | ❌ |

Additionally sends a **heartbeat** every tick with agent status, version, and uptime.

## Quick Start

```bash
cd tools/agent/node

# Run with defaults (sends to http://localhost every 10s)
node agent.js

# Run with custom config
LIGHTWATCH_BASE_URL=http://my-lightwatch:80 \
SERVICE_NAME=prod-web-1 \
INTERVAL_SECONDS=15 \
LIGHTWATCH_API_KEY=my-secret-key \
node agent.js
```

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|---|---|---|
| `LIGHTWATCH_BASE_URL` | `http://localhost` | Base URL of the Lightwatch platform |
| `LIGHTWATCH_API_KEY` | _(empty)_ | Optional API key sent as `x-api-key` header |
| `SERVICE_NAME` | `agent` | Service name reported in all metrics |
| `HOSTNAME` | OS hostname | Override the hostname tag |
| `INTERVAL_SECONDS` | `10` | Seconds between collection ticks |

## Event Payloads

### Metric Event

```json
{
  "service": "prod-web-1",
  "name": "cpu_usage",
  "value": 23.45,
  "unit": "percent",
  "tags": { "host": "web-server-1" },
  "meta": { "os": "linux", "arch": "x64", "pid": 12345, "node_version": "v20.10.0" }
}
```

### Heartbeat Event

```json
{
  "service": "prod-web-1",
  "status": "healthy",
  "version": "1.0.0",
  "meta": {
    "uptime_seconds": 3600,
    "os": "linux",
    "arch": "x64",
    "node_version": "v20.10.0",
    "hostname": "web-server-1"
  },
  "tags": { "host": "web-server-1" }
}
```

## Robustness

- **Retry with backoff** — Failed HTTP requests retry up to 3 times with exponential backoff (1s → 2s → 4s)
- **Request timeout** — Each request aborts after 10 seconds via `AbortSignal.timeout`
- **Graceful shutdown** — Responds to `SIGINT` and `SIGTERM`, exits cleanly
- **Structured logging** — All output is JSON to stdout (compatible with log collectors)
- **No root required** — All metrics collected from user-accessible sources

## Log Output

```json
{"ts":"2026-02-14T10:00:00.000Z","level":"info","service":"lightwatch-agent","msg":"agent starting","base_url":"http://localhost","service_name":"prod-1","hostname":"web-server-1","interval_seconds":10,"platform":"linux","arch":"x64","node":"v20.11.0","pid":12345,"api_key_set":false}
{"ts":"2026-02-14T10:00:10.000Z","level":"info","service":"lightwatch-agent","msg":"tick","metrics_sent":6,"metrics_total":6,"heartbeat":"ok","uptime_seconds":10}
```

## Run as systemd Service (Linux)

```bash
# Copy service file
sudo cp lightwatch-agent.service /etc/systemd/system/

# Edit the service file to set your environment variables
sudo systemctl edit lightwatch-agent

# Start and enable
sudo systemctl daemon-reload
sudo systemctl enable --now lightwatch-agent

# Check status and logs
sudo systemctl status lightwatch-agent
journalctl -u lightwatch-agent -f
```

## Run with Docker

```bash
docker run -d --name lightwatch-agent \
  -e LIGHTWATCH_BASE_URL=http://host.docker.internal \
  -e SERVICE_NAME=docker-host-1 \
  -e INTERVAL_SECONDS=10 \
  --restart unless-stopped \
  node:20-alpine node /app/agent.js
```

Or add to your `docker-compose.yml`:

```yaml
services:
  lightwatch-agent:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./tools/agent/node:/app:ro
      - /proc:/host/proc:ro  # for network stats
    command: node agent.js
    environment:
      - LIGHTWATCH_BASE_URL=http://traefik
      - SERVICE_NAME=docker-host
      - INTERVAL_SECONDS=10
    restart: unless-stopped
```

## Architecture

```
┌─────────────────────────────────────────────┐
│             Lightwatch Agent                │
│                                             │
│  ┌──────────┐  ┌─────────┐  ┌───────────┐  │
│  │ CPU      │  │ Memory  │  │ Disk      │  │
│  │ (os.cpus)│  │ (os.mem)│  │ (df -P /) │  │
│  └────┬─────┘  └────┬────┘  └─────┬─────┘  │
│       │              │             │         │
│  ┌────┴─────┐  ┌─────┴────┐       │         │
│  │ Load Avg │  │ Network  │       │         │
│  │ (os.load)│  │ (/proc)  │       │         │
│  └────┬─────┘  └────┬─────┘       │         │
│       └──────────────┼─────────────┘         │
│                      ▼                       │
│              ┌──────────────┐                │
│              │  HTTP POST   │                │
│              │  with retry  │                │
│              └──────┬───────┘                │
└─────────────────────┼───────────────────────┘
                      ▼
        ┌──────────────────────────┐
        │  Lightwatch Platform     │
        │  POST /ingest/metrics    │
        │  POST /ingest/heartbeat  │
        └──────────────────────────┘
```
