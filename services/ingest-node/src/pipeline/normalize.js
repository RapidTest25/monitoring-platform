"use strict";

const crypto = require("crypto");

/**
 * Generate a 32-character hex event ID.
 */
function generateEventId() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Normalize an incoming event, ensuring:
 * - event_id is present (generated if missing)
 * - schema_version defaults to 2
 * - timestamp and received_at are Date objects
 */
function normalize(event) {
  return {
    ...event,
    event_id: event.event_id || generateEventId(),
    schema_version: event.schema_version || 2,
    timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
    received_at: new Date(),
  };
}

module.exports = { normalize };
