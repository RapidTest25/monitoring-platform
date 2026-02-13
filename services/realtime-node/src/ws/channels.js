"use strict";

/**
 * Channel definitions mapping URL paths to Redis stream keys.
 */
const CHANNELS = {
  "/ws/logs": { stream: "stream:logs", name: "logs" },
  "/ws/alerts": { stream: "stream:alerts", name: "alerts" },
  "/ws/metrics": { stream: "stream:metrics", name: "metrics" },
  "/ws/security": { stream: "stream:security", name: "security" },
};

/**
 * Resolve a URL path to a channel config, or null.
 */
function resolveChannel(urlPath) {
  // Strip query string
  const path = urlPath.split("?")[0];
  return CHANNELS[path] || null;
}

module.exports = { CHANNELS, resolveChannel };
