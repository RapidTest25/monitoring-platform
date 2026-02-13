"use strict";

/**
 * Simple in-memory sliding-window rate limiter per IP (non-Express).
 * Returns true if the request may proceed, false if rejected.
 */
const hits = new Map();

function checkRateLimit(req, res, env) {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = env.RATE_LIMIT_WINDOW_MS;
  const max = env.RATE_LIMIT_MAX;

  let record = hits.get(ip);
  if (!record || now - record.start > windowMs) {
    record = { start: now, count: 0 };
    hits.set(ip, record);
  }

  record.count += 1;

  if (record.count > max) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "rate_limited", message: "too many requests" }),
    );
    return false;
  }

  return true;
}

// Cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of hits) {
    if (now - record.start > 60000) hits.delete(ip);
  }
}, 60_000).unref();

module.exports = { checkRateLimit };
