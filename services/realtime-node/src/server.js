"use strict";

const http = require("http");
const Redis = require("ioredis");

const Hub = require("./ws/hub");
const RedisStreamSubscriber = require("./subscribers/redis_stream_sub");
const { Logger } = require("./utils/logger");

const logger = new Logger("lightwatch-realtime");

const PORT = parseInt(process.env.PORT, 10) || 3002;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  // ── Redis ──
  const redis = new Redis(REDIS_URL, {
    retryStrategy: (times) => Math.min(times * 200, 5000),
    maxRetriesPerRequest: 3,
  });
  redis.on("connect", () => logger.info("connected to Redis"));
  redis.on("error", (err) =>
    logger.error("Redis error", { error: err.message }),
  );

  // ── HTTP server (needed for WS upgrade + health) ──
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "realtime-node" }));
  });

  // ── WebSocket Hub ──
  const hub = new Hub();
  hub.attach(server);

  // ── Redis Stream Subscriber ──
  const subscriber = new RedisStreamSubscriber(redis, hub);
  await subscriber.start();

  // ── Start ──
  server.listen(PORT, () => {
    logger.info(`Realtime service listening on :${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info("shutting down…");
    subscriber.stop();
    redis.disconnect();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("fatal startup error", { error: err.message });
  process.exit(1);
});
