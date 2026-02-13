"use strict";

/**
 * Safe JSON parse – returns null on failure.
 */
function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Serialize value to JSON string.
 */
function stringify(obj) {
  return JSON.stringify(obj);
}

module.exports = { safeParse, stringify };
