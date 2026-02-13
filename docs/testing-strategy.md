# Lightwatch — Testing Strategy

## Overview

This document defines the multi-layered testing strategy for the Lightwatch
monitoring platform across all three microservices.

---

## 1. Unit Tests

### Go API (`services/api-go`)

| Layer        | Test Target                             | Approach                                            |
| ------------ | --------------------------------------- | --------------------------------------------------- |
| Domain       | Filter validation, AlertCondition logic | Table-driven tests                                  |
| Repository   | MongoDB queries                         | Interface mocks                                     |
| Usecase      | Business logic orchestration            | Mock repositories via domain interfaces             |
| Handler      | HTTP request/response                   | `httptest.NewRequest` + `httptest.ResponseRecorder` |
| Middleware   | Auth, rate-limit, CORS, recovery        | Isolated handler wrapping                           |
| Alert Engine | Threshold detection, `breached()`       | Table-driven with edge cases                        |

**Example — Usecase test with mock repo:**

```go
type mockLogsRepo struct {
    result []domain.LogEvent
    total  int64
    err    error
}

func (m *mockLogsRepo) Find(ctx context.Context, f domain.LogsFilter) ([]domain.LogEvent, int64, error) {
    return m.result, m.total, m.err
}

func TestQueryLogs_Execute(t *testing.T) {
    mock := &mockLogsRepo{total: 42}
    uc := usecase.NewQueryLogs(mock)
    _, total, err := uc.Execute(context.Background(), domain.LogsFilter{Service: "web"})
    if err != nil || total != 42 {
        t.Fatalf("expected total=42, got %d, err=%v", total, err)
    }
}
```

### Node.js Ingest (`services/ingest-node`)

| Module         | Test Target                                  | Approach                                          |
| -------------- | -------------------------------------------- | ------------------------------------------------- |
| `validate.js`  | Schema validation for all event types        | Direct function calls with valid/invalid payloads |
| `normalize.js` | event_id generation, timestamp normalization | Assert fields are set                             |
| `pipeline`     | publishToStream                              | Mock Redis `xadd`                                 |
| `middleware`   | Auth, rate limiting, body parsing            | Mock `req`/`res` objects                          |

### Node.js Realtime (`services/realtime-node`)

| Module        | Test Target                        | Approach                               |
| ------------- | ---------------------------------- | -------------------------------------- |
| `auth.js`     | JWT verification, API key fallback | Test with valid/expired/invalid tokens |
| `channels.js` | Path → channel resolution          | Direct function calls                  |
| `hub.js`      | Client tracking, broadcast         | Mock WebSocket objects                 |

---

## 2. Integration Tests

### API ↔ MongoDB

Test real MongoDB operations using a test database:

```bash
# Start test database
MONGO_URI=mongodb://localhost:27017/monitoring_test go test ./internal/repository/... -v
```

- Insert test documents, verify Find with filters
- Test pagination (page, limit, total count)
- Test time-range filtering (from/to params)
- Test TTL index behavior (insert with old received_at, verify deletion)

### Ingest → Redis → Realtime Pipeline

End-to-end flow test:

1. POST event to `/ingest/logs`
2. Verify document appears in MongoDB
3. Verify Redis Stream `stream:logs` has the entry
4. Connect WebSocket to `/ws/logs`
5. POST another event
6. Assert WebSocket receives the broadcast

### Alert Engine

1. Insert a metric above threshold
2. Create an alert rule targeting that metric
3. Trigger one detection tick
4. Verify `alert_events` collection has a firing record
5. Verify webhook was called (use a local HTTP server)

---

## 3. Load Testing

### Tools

- **k6** (primary) — scriptable load testing
- **wrk** — raw HTTP throughput benchmarking
- **websocat** — WebSocket load testing

### Scenarios

| Scenario          | Target                    | Metric                | SLA                      |
| ----------------- | ------------------------- | --------------------- | ------------------------ |
| Ingest sustained  | POST /ingest/logs         | req/s, p99 latency    | 5,000 req/s, p99 < 100ms |
| API query         | GET /api/logs?service=web | req/s, p99 latency    | 2,000 req/s, p99 < 200ms |
| WebSocket fan-out | /ws/logs broadcast        | messages/s per client | 1,000 msg/s, 100 clients |
| Mixed workload    | All endpoints             | Overall throughput    | 3,000 req/s combined     |

### k6 Script Example

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 50 }, // ramp up
    { duration: "2m", target: 200 }, // sustained
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(99)<200"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const payload = JSON.stringify({
    service: "load-test",
    level: "info",
    message: `test event ${Date.now()}`,
    schema_version: 2,
  });

  const res = http.post("http://localhost/ingest/logs", payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "status is 201": (r) => r.status === 201,
  });

  sleep(0.1);
}
```

---

## 4. Stress Testing

### Objectives

- Find the breaking point of each service
- Verify graceful degradation under overload
- Validate rate limiter effectiveness

### Scenarios

| Test             | Method                                  | Expected Behavior                              |
| ---------------- | --------------------------------------- | ---------------------------------------------- |
| Redis down       | Stop Redis container                    | Ingest returns 503, realtime reconnects        |
| MongoDB slow     | Inject latency with `tc` or toxiproxy   | API responds with timeout error, doesn't crash |
| Memory pressure  | Limit container memory to 128MB         | OOM kills are caught, container restarts       |
| Connection flood | 10,000 concurrent WebSocket connections | Hub handles cleanly, older connections evicted |
| Large payload    | POST 2MB body                           | 413 Payload Too Large from middleware          |

### Chaos Engineering

```bash
# Kill Redis mid-operation
docker compose stop redis
sleep 5
docker compose start redis
# Verify services recover automatically
```

---

## 5. Test Execution

### CI Pipeline Structure

```yaml
stages:
  - lint
  - unit
  - build
  - integration
  - load

unit-go:
  script:
    - cd services/api-go && go test ./... -v -race -coverprofile=coverage.out

unit-node:
  script:
    - cd services/ingest-node && npm test
    - cd services/realtime-node && npm test

integration:
  services:
    - redis:7
    - mongo:7
  script:
    - npm run test:integration

load:
  script:
    - docker compose up -d
    - k6 run tests/load/ingest.js
    - k6 run tests/load/api.js
```

### Coverage Targets

| Service       | Target |
| ------------- | ------ |
| api-go        | ≥ 80%  |
| ingest-node   | ≥ 85%  |
| realtime-node | ≥ 75%  |
