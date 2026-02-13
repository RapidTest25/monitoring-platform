# Lightwatch — Security Hardening Plan

## Overview

This document defines the security hardening measures for the Lightwatch
monitoring platform across network, application, and data layers.

---

## 1. Authentication & Authorization

### API Key Authentication

All API and ingest endpoints require an `x-api-key` header when `API_KEY`
environment variable is set:

```
x-api-key: <your-api-key>
```

The Go API middleware validates this in `middleware/auth.go`:

- Returns 401 if key is missing or invalid
- Skips auth for `/api/health` endpoint
- Key comparison uses constant-time comparison to prevent timing attacks

### WebSocket JWT Authentication

WebSocket connections support HMAC-SHA256 JWT tokens:

```
ws://host/ws/logs?token=<jwt-token>
```

**Token structure:**

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
{
  "sub": "dashboard-user",
  "channels": ["logs", "metrics", "alerts"],
  "exp": 1700000000
}
```

**Implementation** (`realtime-node/src/utils/auth.js`):

- Zero-dependency JWT verification using Node.js `crypto`
- `crypto.timingSafeEqual` for signature comparison
- Expiry check (`exp` claim)
- Fallback to plain API key if JWT_SECRET is not configured

### Future: Role-Based Access Control

```
Roles: admin, operator, viewer
Permissions matrix:
  admin    → all endpoints, manage alerts
  operator → read + create alerts
  viewer   → read-only endpoints
```

---

## 2. Input Validation

### Schema Validation (Ingest)

All incoming events are validated against JSON Schema v2 contracts using AJV:

| Setting                       | Value                 | Purpose                    |
| ----------------------------- | --------------------- | -------------------------- |
| `allErrors: true`             | Report all violations | Better error messages      |
| `coerceTypes: false`          | No type coercion      | Strict type safety         |
| `additionalProperties: false` | Reject unknown fields | Prevent data injection     |
| `maxLength` on strings        | 128–4096              | Prevent oversized payloads |

### Request Size Limits

| Layer       | Limit           | Implementation                        |
| ----------- | --------------- | ------------------------------------- |
| Ingest body | 1 MB            | `pipeline.js` body parser             |
| Go API      | 10s ReadTimeout | `http.Server` config                  |
| Traefik     | Default (4MB)   | Traefik default `maxRequestBodyBytes` |

### Query Parameter Sanitization

All Go API handlers parse query parameters through typed functions:

- `strconv.Atoi` for page/limit (defaults on failure)
- String parameters used directly in MongoDB filters (no SQL injection risk)
- Time parameters parsed as RFC3339 (rejected if malformed)

---

## 3. Rate Limiting

### Multi-Layer Rate Limiting

```
Client → Traefik (L7) → Service (L5)
         ↓                ↓
         200 req/s        200 req/s per IP
         burst: 400       sliding window
```

**Traefik layer** (`gateway/dynamic.yml`):

- Ingest: 200 avg, 400 burst per second
- API: 100 avg, 200 burst per second

**Service layer**:

- Go API: Token bucket, 200 requests per minute (`middleware/rate_limit.go`)
- Ingest-node: Sliding window per IP, configurable via `RATE_LIMIT_MAX`

### Rate Limit Headers

Responses include standard rate limit headers:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 150
Retry-After: 60  (when limited)
```

---

## 4. Transport Security

### HTTP Security Headers

Applied by Traefik middleware on all API/ingest routes:

| Header                   | Value                             | Purpose               |
| ------------------------ | --------------------------------- | --------------------- |
| `X-Content-Type-Options` | `nosniff`                         | Prevent MIME sniffing |
| `X-Frame-Options`        | `DENY`                            | Prevent clickjacking  |
| `X-XSS-Protection`       | `1; mode=block`                   | XSS filter            |
| `Referrer-Policy`        | `strict-origin-when-cross-origin` | Limit referrer leaks  |

### CORS Configuration

- Go API: Permissive CORS in `middleware/cors.go` — configurable origins
- Ingest-node: `Access-Control-Allow-Origin: *` (should be restricted in production)

**Production recommendation:**

```javascript
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(",") || [
  "https://dashboard.example.com",
];
```

### TLS (Production)

For production, add TLS to Traefik:

```yaml
# traefik.yml
entryPoints:
  websecure:
    address: ":443"
certificatesResolvers:
  letsencrypt:
    acme:
      email: ops@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

---

## 5. Data Protection

### MongoDB Atlas Security

- TLS-encrypted connections via `mongodb+srv://`
- IP access list configured in Atlas console
- Database user with minimal privileges (readWrite on `monitoring` only)
- Network peering for production (no public IP exposure)

### Redis Security

- No authentication in development (local only)
- Production: Set `requirepass` in redis.conf
- Production: Bind to private network interface only

### Secrets Management

| Secret       | Storage                    | Notes                |
| ------------ | -------------------------- | -------------------- |
| `MONGO_URI`  | `.env` file, not committed | Contains credentials |
| `API_KEY`    | `.env` file                | Rotatable            |
| `JWT_SECRET` | `.env` file                | Min 256-bit entropy  |

**`.gitignore` ensures `.env` files are never committed.**

---

## 6. Container Security

### Docker Best Practices

- Base images: `node:18-alpine`, `golang:1.22-alpine` (minimal attack surface)
- Multi-stage builds for Go (final image is `alpine` only)
- `npm ci --production` (no dev dependencies in image)
- No running as root: Add `USER node` / `USER nonroot`

### Recommended Dockerfile additions:

```dockerfile
# Node.js
RUN addgroup -g 1001 app && adduser -u 1001 -G app -s /bin/sh -D app
USER app

# Go (already uses scratch or alpine)
USER nonroot:nonroot
```

### Resource Limits

Docker Compose enforces resource constraints to prevent denial-of-service:

```yaml
deploy:
  resources:
    limits:
      memory: 256M
      cpus: "1.0"
```

---

## 7. Logging & Audit

### Structured Logging

All services output JSON-structured logs to stdout:

```json
{
  "time": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "api-go",
  "msg": "request",
  "method": "GET",
  "path": "/api/logs",
  "status": 200,
  "duration_ms": 15,
  "request_id": "abc123"
}
```

### Request Tracing

- `X-Request-ID` header propagated through all services
- `trace_id` field in events correlates related operations
- Request ID included in all log entries for correlation

### Security Event Monitoring

The platform ingests its own security events:

- Failed auth attempts logged with source IP
- Rate-limited requests tracked
- Schema validation failures recorded

---

## 8. Vulnerability Management

### Dependency Scanning

```bash
# Go
go list -m all | nancy sleuth        # or govulncheck
govulncheck ./...

# Node.js
npm audit
npm audit fix
```

### Recommended CI Integration

```yaml
security-scan:
  script:
    - cd services/api-go && govulncheck ./...
    - cd services/ingest-node && npm audit --audit-level=high
    - cd services/realtime-node && npm audit --audit-level=high
    - trivy image lightwatch-api-go:latest
    - trivy image lightwatch-ingest-node:latest
```
