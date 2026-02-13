"use strict";

const http = require("http");
const { MongoClient } = require("mongodb");
const Redis = require("ioredis");

const env = require("./config/env");
const { createRouter } = require("./routes/router");
const { applyMiddleware } = require("./middleware/pipeline");
const { Logger } = require("./utils/logger");

const logger = new Logger("lightwatch-ingest");

/**
 * Connect to MongoDB with retry logic.
 */
async function connectMongo(uri, retries = 5, delay = 2000) {
  const client = new MongoClient(uri);
  for (let i = 1; i <= retries; i++) {
    try {
      await client.connect();
      await client.db().command({ ping: 1 });
      logger.info("connected to MongoDB");
      return client;
    } catch (err) {
      logger.warn(`MongoDB connect attempt ${i}/${retries} failed`, {
        error: err.message,
      });
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Connect to Redis with built-in reconnect.
 */
function connectRedis(url) {
  const redis = new Redis(url, {
    retryStrategy: (times) => Math.min(times * 200, 5000),
    maxRetriesPerRequest: 3,
  });
  redis.on("connect", () => logger.info("connected to Redis"));
  redis.on("error", (err) =>
    logger.error("Redis error", { error: err.message }),
  );
  return redis;
}

async function main() {
  // ── Connections ──
  const mongo = await connectMongo(env.MONGO_URI);
  const db = mongo.db();
  const redis = connectRedis(env.REDIS_URL);

  // ── Router ──
  const router = createRouter(db, redis);

  // ── HTTP Server (native) ──
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, x-api-key, X-Request-ID",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    // Request tracking
    const { id: requestId, finish } = logger.request(req);
    res.setHeader("X-Request-ID", requestId);

    try {
      await applyMiddleware(req, res, env);

      if (res.writableEnded) {
        finish(res.statusCode || 200);
        return;
      }

      const handler = router(req);
      if (handler) {
        await handler(req, res, db, redis);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "not_found", message: "route not found" }),
        );
      }
    } catch (err) {
      logger.error("unhandled error", { error: err.message, stack: err.stack });
      if (!res.writableEnded) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "internal",
            message: "internal server error",
          }),
        );
      }
    }

    finish(res.statusCode || 200);
  });

  server.listen(env.PORT, () => {
    logger.info(`Lightwatch Ingest listening on :${env.PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("shutting down…");
    server.close();
    await mongo.close();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("fatal startup error", { error: err.message });
  process.exit(1);
});
