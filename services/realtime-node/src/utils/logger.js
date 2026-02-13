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
}

module.exports = { Logger };
