"use strict";

const { handleIngestMetrics } = require("./ingest_metrics");
const { handleIngestLogs } = require("./ingest_logs");
const { handleIngestSecurity } = require("./ingest_security");
const { handleIngestHeartbeat } = require("./ingest_heartbeat");

/**
 * Creates a simple router function.
 * Returns a route handler based on method + pathname, or null.
 */
function createRouter(db, redis) {
  const routes = {
    "POST /ingest/metrics": (req, res) =>
      handleIngestMetrics(req, res, db, redis),
    "POST /ingest/logs": (req, res) => handleIngestLogs(req, res, db, redis),
    "POST /ingest/security": (req, res) =>
      handleIngestSecurity(req, res, db, redis),
    "POST /ingest/heartbeat": (req, res) => handleIngestHeartbeat(req, res, db),
    "GET /health": (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "lightwatch-ingest" }));
    },
  };

  return function resolve(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const key = `${req.method} ${url.pathname}`;
    return routes[key] || null;
  };
}

module.exports = { createRouter };
