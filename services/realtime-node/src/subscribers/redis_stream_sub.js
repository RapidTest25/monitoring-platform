"use strict";

const { CHANNELS } = require("../ws/channels");

/**
 * Subscribe to Redis Streams and broadcast events to the Hub.
 *
 * Uses consumer groups for reliable, scalable consumption.
 */
class RedisStreamSubscriber {
  /**
   * @param {import('ioredis').Redis} redis
   * @param {import('../ws/hub')} hub
   */
  constructor(redis, hub) {
    this.redis = redis;
    this.hub = hub;
    this.running = false;
    this.consumerGroup = "realtime-group";
    this.consumerName = `realtime-${process.pid}`;
  }

  async start() {
    this.running = true;

    // Ensure consumer groups exist for each stream
    for (const ch of Object.values(CHANNELS)) {
      try {
        await this.redis.xgroup(
          "CREATE",
          ch.stream,
          this.consumerGroup,
          "0",
          "MKSTREAM",
        );
        console.log(`[sub] created consumer group for ${ch.stream}`);
      } catch (err) {
        // BUSYGROUP = group already exists, which is fine
        if (!err.message.includes("BUSYGROUP")) {
          console.error(
            `[sub] error creating group for ${ch.stream}:`,
            err.message,
          );
        }
      }
    }

    this._poll();
  }

  stop() {
    this.running = false;
  }

  async _poll() {
    while (this.running) {
      try {
        // XREADGROUP expects: STREAMS key1 key2 ... id1 id2 ...
        const channelList = Object.values(CHANNELS);
        const keys = channelList.map((ch) => ch.stream);
        const ids = channelList.map(() => ">");

        const results = await this.redis.xreadgroup(
          "GROUP",
          this.consumerGroup,
          this.consumerName,
          "COUNT",
          100,
          "BLOCK",
          2000,
          "STREAMS",
          ...keys,
          ...ids,
        );

        if (!results) continue;

        for (const [streamKey, entries] of results) {
          const channel = Object.values(CHANNELS).find(
            (c) => c.stream === streamKey,
          );
          if (!channel) continue;

          for (const [id, fields] of entries) {
            // fields is [key, value, key, value, ...]
            const dataIdx = fields.indexOf("data");
            if (dataIdx !== -1 && dataIdx + 1 < fields.length) {
              const payload = fields[dataIdx + 1];
              this.hub.broadcast(channel.name, payload);
            }

            // ACK the message
            await this.redis.xack(channel.stream, this.consumerGroup, id);
          }
        }
      } catch (err) {
        if (this.running) {
          console.error("[sub] poll error:", err.message);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }
}

module.exports = RedisStreamSubscriber;
