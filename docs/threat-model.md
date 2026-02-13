# Threat Model

## Assets

- Ingested telemetry data (logs, metrics, security events)
- Alert rules and configuration
- MongoDB and Redis credentials
- API keys / tokens

## Trust Boundaries

1. **External → Gateway** – untrusted agents and clients hit Traefik
2. **Gateway → Services** – Traefik forwards validated requests internally
3. **Services → Data Stores** – internal network only

## Threats & Mitigations

| #   | Threat                                                | Category               | Mitigation                                                            |
| --- | ----------------------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| T1  | Unauthenticated ingest flooding                       | DoS                    | Rate-limit at gateway (Traefik middleware); optional API-key auth     |
| T2  | Malicious log injection (XSS via stored log messages) | Injection              | Sanitize/escape all stored strings before rendering in any UI         |
| T3  | NoSQL injection in query parameters                   | Injection              | Use parameterized MongoDB queries; validate & whitelist query fields  |
| T4  | WebSocket abuse (mass connections)                    | DoS                    | Limit max WS connections per IP; idle-timeout disconnection           |
| T5  | Credential leakage in logs                            | Information Disclosure | Never log secrets; use env vars; rotate credentials regularly         |
| T6  | Unencrypted traffic between agent and platform        | Eavesdropping          | TLS termination at Traefik; mTLS for agents in production             |
| T7  | Privilege escalation via alert-rule creation          | Elevation              | Validate alert payloads strictly; restrict POST /api/alerts to admins |
| T8  | Redis stream poisoning from compromised service       | Tampering              | Network segmentation; restrict Redis access to internal services only |

## Security Controls

- **Gateway rate-limiting** – configurable per-route in Traefik
- **Input validation** – JSON schema validation on ingest and alert endpoints
- **CORS** – locked to known origins in production
- **Secrets management** – all credentials via environment variables, never committed
- **Network isolation** – MongoDB & Redis only accessible from internal Docker network
