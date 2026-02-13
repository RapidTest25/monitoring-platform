"use strict";

const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const ajv = new Ajv({ allErrors: true, coerceTypes: false });
addFormats(ajv);

// ── Common field definitions (v2 schema) ──

const commonOptionalFields = {
  event_id: { type: "string", maxLength: 64 },
  trace_id: { type: "string", maxLength: 64 },
  schema_version: { type: "integer", minimum: 1 },
  timestamp: { type: "string", format: "date-time" },
};

// ── Schemas (v2) ──

const metricSchema = {
  type: "object",
  required: ["service", "name", "value"],
  properties: {
    service: { type: "string", minLength: 1, maxLength: 128 },
    name: { type: "string", minLength: 1, maxLength: 128 },
    value: { type: "number" },
    unit: { type: "string", maxLength: 32 },
    tags: { type: "object", additionalProperties: { type: "string" } },
    meta: { type: "object" },
    ...commonOptionalFields,
  },
  additionalProperties: false,
};

const logSchema = {
  type: "object",
  required: ["service", "level", "message"],
  properties: {
    service: { type: "string", minLength: 1, maxLength: 128 },
    level: {
      type: "string",
      enum: ["debug", "info", "warn", "error", "fatal"],
    },
    message: { type: "string", minLength: 1, maxLength: 4096 },
    meta: { type: "object" },
    tags: { type: "object", additionalProperties: { type: "string" } },
    ...commonOptionalFields,
  },
  additionalProperties: false,
};

const securitySchema = {
  type: "object",
  required: ["service", "type", "source_ip"],
  properties: {
    service: { type: "string", minLength: 1, maxLength: 128 },
    type: {
      type: "string",
      enum: [
        "brute_force",
        "port_scan",
        "auth_failure",
        "malware",
        "injection",
        "xss",
        "ddos",
        "privilege_escalation",
        "other",
      ],
    },
    source_ip: { type: "string", minLength: 1, maxLength: 45 },
    description: { type: "string", maxLength: 2048 },
    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
    meta: { type: "object" },
    tags: { type: "object", additionalProperties: { type: "string" } },
    ...commonOptionalFields,
  },
  additionalProperties: false,
};

const heartbeatSchema = {
  type: "object",
  required: ["service"],
  properties: {
    service: { type: "string", minLength: 1, maxLength: 128 },
    host: { type: "string", maxLength: 256 },
    status: {
      type: "string",
      enum: ["healthy", "degraded", "unhealthy"],
    },
    version: { type: "string", maxLength: 64 },
    meta: { type: "object" },
    tags: { type: "object", additionalProperties: { type: "string" } },
    ...commonOptionalFields,
  },
  additionalProperties: false,
};

// Pre-compile validators
const validators = {
  metric: ajv.compile(metricSchema),
  log: ajv.compile(logSchema),
  security: ajv.compile(securitySchema),
  heartbeat: ajv.compile(heartbeatSchema),
};

/**
 * Validate payload against a named schema.
 * Returns { valid, errors }.
 */
function validate(schemaName, data) {
  const fn = validators[schemaName];
  if (!fn)
    return {
      valid: false,
      errors: [{ message: `unknown schema: ${schemaName}` }],
    };
  const valid = fn(data);
  return { valid, errors: fn.errors || [] };
}

module.exports = { validate };
