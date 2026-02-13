import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 30 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    errors: ["rate<0.1"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost";

export default function () {
  const endpoints = [
    `${BASE_URL}/api/health`,
    `${BASE_URL}/api/services`,
    `${BASE_URL}/api/logs?page=1`,
    `${BASE_URL}/api/logs?service=loadtest-svc&level=error&page=1`,
    `${BASE_URL}/api/metrics?service=loadtest-svc`,
    `${BASE_URL}/api/security/events?type=brute_force`,
    `${BASE_URL}/api/alerts`,
  ];

  const url = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(url);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
  });
  errorRate.add(!ok);

  sleep(0.2);
}
