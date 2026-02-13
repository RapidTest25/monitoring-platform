"use strict";

const { validate } = require("../utils/validate");
const { normalize } = require("../pipeline/normalize");
const { publishToStream } = require("../pipeline/publish_stream");

/**
 * POST /ingest/logs handler (native http).
 */
async function handleIngestLogs(req, res, db, redis) {
  const { valid, errors } = validate("log", req.body);
  if (!valid) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ error: "validation_error", details: errors }),
    );
  }

  const event = normalize(req.body);

  try {
    const result = await db.collection("logs").insertOne(event);
    await publishToStream(redis, "stream:logs", event);

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "accepted", id: result.insertedId }));
  } catch (err) {
    console.error("[ingest/logs] error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "internal", message: "failed to ingest log" }),
    );
  }
}

module.exports = { handleIngestLogs };
