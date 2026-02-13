"use strict";

/**
 * Structured JSON logger for Lightwatch services.
 * Outputs one JSON line per log entry to stdout.
 */
class Logger {
  constructor(service) {
    this.service = service;
  }

  _write(level, msg, fields = {}) {
    const entry = {
      time: new Date().toISOString(),
      level,
      service: this.service,
      msg,
      ...fields,
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  }

  info(msg, fields) {
    this._write("info", msg, fields);
  }

  warn(msg, fields) {
    this._write("warn", msg, fields);
  }

  error(msg, fields) {
    this._write("error", msg, fields);
  }

  /**
   * Returns a request logging function for the native http pipeline.
   * Call at start of request, returns a finish() function.
   */
  request(req) {
    const start = Date.now();
    const id = req.headers["x-request-id"] || randomHexId();
    return {
      id,
      finish: (statusCode) => {
        this._write("info", "request", {
          method: req.method,
          path: req.url,
          status: statusCode,
          duration_ms: Date.now() - start,
          remote: req.socket.remoteAddress,
          request_id: id,
        });
      },
    };
  }
}

function randomHexId() {
  const bytes = new Uint8Array(16);
  require("crypto").getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

module.exports = { Logger };
