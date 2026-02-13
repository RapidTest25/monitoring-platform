"use strict";

const { checkAuth } = require("./auth_optional");
const { checkRateLimit } = require("./rate_limit");

/**
 * Read the request body as JSON (replaces express.json()).
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    // Only parse for methods that have bodies
    if (
      req.method === "GET" ||
      req.method === "HEAD" ||
      req.method === "OPTIONS"
    ) {
      req.body = null;
      return resolve();
    }

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("application/json")) {
      req.body = null;
      return resolve();
    }

    let data = "";
    let size = 0;
    const MAX_SIZE = 1024 * 1024; // 1 MB

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_SIZE) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      data += chunk;
    });

    req.on("end", () => {
      try {
        req.body = data ? JSON.parse(data) : null;
        resolve();
      } catch {
        reject(new Error("invalid_json"));
      }
    });

    req.on("error", reject);
  });
}

/**
 * Apply the middleware pipeline: body parsing → auth → rate limit.
 * If a middleware rejects the request, it writes the response and ends it.
 */
async function applyMiddleware(req, res, env) {
  // 1) Parse JSON body
  try {
    await parseBody(req);
  } catch (err) {
    if (err.message === "payload_too_large") {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "payload_too_large",
          message: "request body exceeds 1 MB",
        }),
      );
      return;
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "bad_request", message: "invalid JSON body" }),
    );
    return;
  }

  // 2) Optional auth
  if (!checkAuth(req, res, env)) return;

  // 3) Rate limit
  if (!checkRateLimit(req, res, env)) return;
}

module.exports = { applyMiddleware };
