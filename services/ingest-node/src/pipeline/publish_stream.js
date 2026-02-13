"use strict";

const { stringify } = require("../utils/json");

/**
 * Publish an event to a Redis Stream.
 * @param {import('ioredis').Redis} redis
 * @param {string} streamKey – e.g. 'stream:logs'
 * @param {object} event
 */
async function publishToStream(redis, streamKey, event) {
  await redis.xadd(streamKey, "*", "data", stringify(event));
}

module.exports = { publishToStream };
