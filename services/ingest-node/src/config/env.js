"use strict";

const env = {
  PORT: parseInt(process.env.PORT, 10) || 3001,
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/monitoring",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  NODE_ENV: process.env.NODE_ENV || "development",
  API_KEY: process.env.API_KEY || "", // optional auth
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
};

module.exports = env;
