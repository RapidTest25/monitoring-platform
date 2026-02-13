import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.1"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost";

export default function () {
  const endpoints = [
    {
      url: `${BASE_URL}/ingest/metrics`,
      body: JSON.stringify({
        service: "loadtest-svc",
        name: "cpu_usage",
        value: Math.random() * 100,
        unit: "percent",
        tags: { host: "k6-runner" },
        timestamp: new Date().toISOString(),
      }),
    },
    {
      url: `${BASE_URL}/ingest/logs`,
      body: JSON.stringify({
        service: "loadtest-svc",
        level: ["info", "warn", "error", "debug"][
          Math.floor(Math.random() * 4)
        ],
        message: `Load test log entry ${Date.now()}`,
        meta: { iteration: __ITER },
        timestamp: new Date().toISOString(),
      }),
    },
    {
      url: `${BASE_URL}/ingest/security`,
      body: JSON.stringify({
        service: "loadtest-svc",
        type: "brute_force",
        source_ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        description: "Load test security event",
        severity: "low",
        timestamp: new Date().toISOString(),
      }),
    },
    {
      url: `${BASE_URL}/ingest/heartbeat`,
      body: JSON.stringify({
        service: "loadtest-svc",
        host: "k6-runner",
        meta: { uptime: 12345 },
      }),
    },
  ];

  const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.post(ep.url, ep.body, {
    headers: { "Content-Type": "application/json" },
  });

  const ok = check(res, {
    "status is 200 or 201": (r) => r.status === 200 || r.status === 201,
  });
  errorRate.add(!ok);

  sleep(0.1);
}
