"use strict";

const { validate } = require("../utils/validate");

/**
 * POST /ingest/heartbeat handler (native http).
 */
async function handleIngestHeartbeat(req, res, db) {
  const { valid, errors } = validate("heartbeat", req.body);
  if (!valid) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ error: "validation_error", details: errors }),
    );
  }

  const { service, host, status, version, meta, tags } = req.body;
  const now = new Date();

  try {
    await db.collection("services").updateOne(
      { name: service },
      {
        $set: {
          host: host || "",
          last_heartbeat: now,
          status: status || "healthy",
          version: version || "",
          meta: meta || {},
          tags: tags || {},
        },
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service }));
  } catch (err) {
    console.error("[ingest/heartbeat] error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "internal",
        message: "failed to process heartbeat",
      }),
    );
  }
}

module.exports = { handleIngestHeartbeat };
