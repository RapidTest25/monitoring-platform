"use strict";

const { randomUUID } = require("crypto");
const WebSocket = require("ws");
const { verifyToken } = require("../utils/auth");
const { resolveChannel } = require("./channels");

/**
 * WebSocket Hub — manages client connections per channel and broadcasts messages.
 */
class Hub {
  constructor() {
    /** @type {Map<string, Map<string, WebSocket>>} channelName → (clientId → ws) */
    this.channels = new Map();
  }

  /**
   * Attach the Hub to an HTTP server.
   */
  attach(server) {
    const wss = new WebSocket.Server({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
      // Auth check — returns payload object or null
      const authPayload = verifyToken(req.url);
      if (!authPayload) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const channel = resolveChannel(req.url);
      if (!channel) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        this._onConnection(ws, channel);
      });
    });

    return wss;
  }

  _onConnection(ws, channel) {
    const clientId = randomUUID();

    if (!this.channels.has(channel.name)) {
      this.channels.set(channel.name, new Map());
    }
    this.channels.get(channel.name).set(clientId, ws);

    console.log(
      `[hub] client ${clientId} joined channel '${channel.name}' (total: ${this.channels.get(channel.name).size})`,
    );

    ws.on("close", () => {
      const ch = this.channels.get(channel.name);
      if (ch) {
        ch.delete(clientId);
        console.log(
          `[hub] client ${clientId} left channel '${channel.name}' (total: ${ch.size})`,
        );
      }
    });

    ws.on("error", (err) => {
      console.error(`[hub] client ${clientId} error:`, err.message);
    });
  }

  /**
   * Broadcast a message to all clients on a channel.
   */
  broadcast(channelName, data) {
    const ch = this.channels.get(channelName);
    if (!ch) return;

    const payload = typeof data === "string" ? data : JSON.stringify(data);

    for (const [id, ws] of ch) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

module.exports = Hub;
