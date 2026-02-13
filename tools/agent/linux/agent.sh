#!/usr/bin/env bash
# agent.sh — Lightweight monitoring agent
# Sends heartbeat + basic system metrics to the ingest service every INTERVAL seconds.
#
# Usage:
#   INGEST_URL=http://localhost/ingest SERVICE_NAME=my-app ./agent.sh
#
# Environment:
#   INGEST_URL      Base URL of the ingest service (default: http://localhost)
#   SERVICE_NAME    Name to report as (default: hostname)
#   INTERVAL        Seconds between reports (default: 30)

set -euo pipefail

INGEST_URL="${INGEST_URL:-http://localhost}"
SERVICE_NAME="${SERVICE_NAME:-$(hostname)}"
INTERVAL="${INTERVAL:-30}"
HOST="$(hostname)"

echo "▶ Agent started: service=${SERVICE_NAME} host=${HOST} interval=${INTERVAL}s"
echo "  Reporting to: ${INGEST_URL}"

while true; do
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  UPTIME_SECS=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)

  # ── Heartbeat ──
  curl -s -X POST "${INGEST_URL}/ingest/heartbeat" \
    -H "Content-Type: application/json" \
    -d "{
      \"service\": \"${SERVICE_NAME}\",
      \"host\": \"${HOST}\",
      \"meta\": { \"uptime\": ${UPTIME_SECS} }
    }" > /dev/null 2>&1 && echo "[${NOW}] ✓ heartbeat" || echo "[${NOW}] ✗ heartbeat failed"

  # ── CPU usage (1-second sample) ──
  CPU=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' || echo "0")
  curl -s -X POST "${INGEST_URL}/ingest/metrics" \
    -H "Content-Type: application/json" \
    -d "{
      \"service\": \"${SERVICE_NAME}\",
      \"name\": \"cpu_usage\",
      \"value\": ${CPU},
      \"unit\": \"percent\",
      \"tags\": { \"host\": \"${HOST}\" },
      \"timestamp\": \"${NOW}\"
    }" > /dev/null 2>&1 && echo "[${NOW}] ✓ cpu_usage=${CPU}%" || echo "[${NOW}] ✗ cpu metric failed"

  # ── Memory usage ──
  if command -v free &>/dev/null; then
    MEM_TOTAL=$(free -m | awk '/Mem:/{print $2}')
    MEM_USED=$(free -m | awk '/Mem:/{print $3}')
    MEM_PCT=$(awk "BEGIN{printf \"%.1f\", ($MEM_USED/$MEM_TOTAL)*100}")

    curl -s -X POST "${INGEST_URL}/ingest/metrics" \
      -H "Content-Type: application/json" \
      -d "{
        \"service\": \"${SERVICE_NAME}\",
        \"name\": \"memory_usage\",
        \"value\": ${MEM_PCT},
        \"unit\": \"percent\",
        \"tags\": { \"host\": \"${HOST}\", \"total_mb\": \"${MEM_TOTAL}\" },
        \"timestamp\": \"${NOW}\"
      }" > /dev/null 2>&1 && echo "[${NOW}] ✓ memory_usage=${MEM_PCT}%" || echo "[${NOW}] ✗ memory metric failed"
  fi

  # ── Disk usage ──
  DISK_PCT=$(df / 2>/dev/null | tail -1 | awk '{gsub(/%/,""); print $5}' || echo "0")
  curl -s -X POST "${INGEST_URL}/ingest/metrics" \
    -H "Content-Type: application/json" \
    -d "{
      \"service\": \"${SERVICE_NAME}\",
      \"name\": \"disk_usage\",
      \"value\": ${DISK_PCT},
      \"unit\": \"percent\",
      \"tags\": { \"host\": \"${HOST}\", \"mount\": \"/\" },
      \"timestamp\": \"${NOW}\"
    }" > /dev/null 2>&1 && echo "[${NOW}] ✓ disk_usage=${DISK_PCT}%" || echo "[${NOW}] ✗ disk metric failed"

  # ── Log sample (info) ──
  curl -s -X POST "${INGEST_URL}/ingest/logs" \
    -H "Content-Type: application/json" \
    -d "{
      \"service\": \"${SERVICE_NAME}\",
      \"level\": \"info\",
      \"message\": \"Agent heartbeat cycle completed\",
      \"meta\": { \"host\": \"${HOST}\", \"uptime\": ${UPTIME_SECS} },
      \"timestamp\": \"${NOW}\"
    }" > /dev/null 2>&1

  sleep "${INTERVAL}"
done
