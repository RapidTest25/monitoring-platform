#!/usr/bin/env node
"use strict";

/**
 * Lightwatch Agent — Zero-dependency Node.js system metrics collector
 *
 * Collects CPU, memory, disk, load average, and network metrics
 * then pushes them to a Lightwatch monitoring platform instance.
 *
 * Supported platforms: Linux, macOS, Windows
 * Requires: Node.js >= 18 (uses fetch + AbortSignal.timeout)
 *
 * Environment variables:
 *   LIGHTWATCH_BASE_URL   Base URL of the platform (default: http://localhost)
 *   LIGHTWATCH_API_KEY    Optional API key for authentication
 *   SERVICE_NAME          Service name to report as (default: "agent")
 *   HOSTNAME              Override OS hostname
 *   INTERVAL_SECONDS      Collection interval in seconds (default: 10)
 */

const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const CONFIG = Object.freeze({
  baseUrl: (process.env.LIGHTWATCH_BASE_URL || "http://localhost").replace(
    /\/$/,
    ""
  ),
  apiKey: process.env.LIGHTWATCH_API_KEY || "",
  serviceName: process.env.SERVICE_NAME || "agent",
  hostname: process.env.HOSTNAME || os.hostname(),
  intervalSeconds: Math.max(
    1,
    parseInt(process.env.INTERVAL_SECONDS, 10) || 10
  ),
  requestTimeoutMs: 10_000,
  maxRetries: 3,
  version: "1.0.0",
});

const PLATFORM = os.platform(); // "linux" | "darwin" | "win32"
const START_TIME = Date.now();

// ─────────────────────────────────────────────
// Structured JSON Logger
// ─────────────────────────────────────────────

function log(level, msg, extra = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: "lightwatch-agent",
    msg,
    ...extra,
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

// ─────────────────────────────────────────────
// CPU Usage (delta-based)
// ─────────────────────────────────────────────

let prevCpuTimes = null;

function getCpuTimes() {
  const cpus = os.cpus();
  let user = 0,
    nice = 0,
    sys = 0,
    idle = 0,
    irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  return { user, nice, sys, idle, irq };
}

function calcCpuPercent() {
  const curr = getCpuTimes();
  if (!prevCpuTimes) {
    prevCpuTimes = curr;
    return null; // first tick, no delta available
  }

  const dUser = curr.user - prevCpuTimes.user;
  const dNice = curr.nice - prevCpuTimes.nice;
  const dSys = curr.sys - prevCpuTimes.sys;
  const dIdle = curr.idle - prevCpuTimes.idle;
  const dIrq = curr.irq - prevCpuTimes.irq;

  const total = dUser + dNice + dSys + dIdle + dIrq;
  prevCpuTimes = curr;

  if (total === 0) return 0;
  return round(((total - dIdle) / total) * 100);
}

// ─────────────────────────────────────────────
// Memory Usage
// ─────────────────────────────────────────────

function getMemoryPercent() {
  const total = os.totalmem();
  const free = os.freemem();
  if (total === 0) return 0;
  return round(((total - free) / total) * 100);
}

// ─────────────────────────────────────────────
// Disk Usage (platform-specific)
// ─────────────────────────────────────────────

function getDiskPercent() {
  try {
    if (PLATFORM === "linux" || PLATFORM === "darwin") {
      // `df -P /` output format:
      // Filesystem 1024-blocks Used Available Capacity Mounted
      // /dev/sda1  50000000   20000000 28000000 42%     /
      const output = execSync("df -P /", {
        encoding: "utf8",
        timeout: 5000,
      });
      const lines = output.trim().split("\n");
      if (lines.length < 2) return null;

      // Capacity column contains "42%" — extract the number
      const cols = lines[1].split(/\s+/);
      const capacityCol = cols.find((c) => c.endsWith("%"));
      if (capacityCol) {
        return parseFloat(capacityCol.replace("%", ""));
      }
      return null;
    }

    if (PLATFORM === "win32") {
      // wmic returns: FreeSpace,Size
      // We query the C: drive
      const output = execSync(
        'wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /format:csv',
        { encoding: "utf8", timeout: 5000 }
      );
      const lines = output.trim().split("\n").filter(Boolean);
      if (lines.length < 2) return null;
      const parts = lines[lines.length - 1].split(",");
      // CSV format: Node,FreeSpace,Size
      const free = parseInt(parts[1], 10);
      const size = parseInt(parts[2], 10);
      if (isNaN(free) || isNaN(size) || size === 0) return null;
      return round(((size - free) / size) * 100);
    }

    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Load Average
// ─────────────────────────────────────────────

function getLoadAvg1m() {
  const avg = os.loadavg();
  // os.loadavg() returns [0, 0, 0] on Windows
  if (PLATFORM === "win32") return null;
  return round(avg[0]);
}

// ─────────────────────────────────────────────
// Network RX/TX (delta-based, platform-specific)
// ─────────────────────────────────────────────

let prevNetStats = null;
let prevNetTime = null;

/**
 * Returns { rx: totalBytesReceived, tx: totalBytesSent } across all
 * non-loopback interfaces, or null if not available.
 */
function getRawNetStats() {
  try {
    if (PLATFORM === "linux") {
      // /proc/net/dev format:
      // Inter-|   Receive                            |  Transmit
      //  face |bytes packets ...                     | bytes packets ...
      //  eth0: 123456 789 ...                         654321 456 ...
      const data = fs.readFileSync("/proc/net/dev", "utf8");
      const lines = data.trim().split("\n").slice(2); // skip header lines
      let rx = 0,
        tx = 0;
      for (const line of lines) {
        const parts = line.trim().split(/[:\s]+/);
        const iface = parts[0];
        if (iface === "lo") continue; // skip loopback
        rx += parseInt(parts[1], 10) || 0;
        tx += parseInt(parts[9], 10) || 0;
      }
      return { rx, tx };
    }

    if (PLATFORM === "darwin") {
      // netstat -ib: Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes
      const output = execSync("netstat -ib", {
        encoding: "utf8",
        timeout: 5000,
      });
      const lines = output.trim().split("\n");
      let rx = 0,
        tx = 0;
      const seen = new Set();
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/\s+/);
        const iface = cols[0];
        if (iface === "lo0" || seen.has(iface)) continue;

        // Only count lines that have Link#N in the Network column
        if (!cols[2] || !cols[2].startsWith("Link#")) continue;
        seen.add(iface);

        const ibytes = parseInt(cols[6], 10);
        const obytes = parseInt(cols[9], 10);
        if (!isNaN(ibytes)) rx += ibytes;
        if (!isNaN(obytes)) tx += obytes;
      }
      return { rx, tx };
    }

    // Windows: skip network metrics (no reliable non-admin method)
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns { rxPerSec, txPerSec } as bytes/second delta, or null on first tick.
 */
function getNetDelta() {
  const stats = getRawNetStats();
  const now = Date.now();

  if (!stats) {
    prevNetStats = null;
    prevNetTime = null;
    return null;
  }

  if (!prevNetStats || !prevNetTime) {
    prevNetStats = stats;
    prevNetTime = now;
    return null; // first tick
  }

  const elapsedSec = (now - prevNetTime) / 1000;
  if (elapsedSec <= 0) return null;

  const rxPerSec = round((stats.rx - prevNetStats.rx) / elapsedSec);
  const txPerSec = round((stats.tx - prevNetStats.tx) / elapsedSec);

  prevNetStats = stats;
  prevNetTime = now;

  return { rxPerSec: Math.max(0, rxPerSec), txPerSec: Math.max(0, txPerSec) };
}

// ─────────────────────────────────────────────
// HTTP Client (fetch + retry + backoff)
// ─────────────────────────────────────────────

async function postJSON(path, body, attempt = 1) {
  const url = `${CONFIG.baseUrl}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (CONFIG.apiKey) {
    headers["x-api-key"] = CONFIG.apiKey;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CONFIG.requestTimeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    return true;
  } catch (err) {
    if (attempt >= CONFIG.maxRetries) {
      log("error", `POST ${path} failed after ${attempt} attempts`, {
        error: err.message,
      });
      return false;
    }

    const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
    log("warn", `POST ${path} attempt ${attempt} failed, retrying in ${backoffMs}ms`, {
      error: err.message,
    });
    await sleep(backoffMs);
    return postJSON(path, body, attempt + 1);
  }
}

// ─────────────────────────────────────────────
// Metric Collection & Dispatch
// ─────────────────────────────────────────────

function buildMeta() {
  return {
    os: PLATFORM,
    arch: os.arch(),
    pid: process.pid,
    node_version: process.version,
  };
}

function makeMetric(name, value, unit) {
  return {
    service: CONFIG.serviceName,
    name,
    value,
    unit,
    tags: { host: CONFIG.hostname },
    meta: buildMeta(),
  };
}

async function collectAndSend() {
  const metrics = [];

  // CPU
  const cpu = calcCpuPercent();
  if (cpu !== null) {
    metrics.push(makeMetric("cpu_usage", cpu, "percent"));
  }

  // Memory
  metrics.push(makeMetric("memory_percent", getMemoryPercent(), "percent"));

  // Disk
  const disk = getDiskPercent();
  if (disk !== null) {
    metrics.push(makeMetric("disk_percent", disk, "percent"));
  }

  // Load average
  const load = getLoadAvg1m();
  if (load !== null) {
    metrics.push(makeMetric("load_1m", load, "load"));
  }

  // Network
  const net = getNetDelta();
  if (net !== null) {
    metrics.push(
      makeMetric("net_rx_bytes_per_sec", net.rxPerSec, "bytes/s"),
      makeMetric("net_tx_bytes_per_sec", net.txPerSec, "bytes/s")
    );
  }

  // Send metrics in parallel
  const metricResults = await Promise.allSettled(
    metrics.map((m) => postJSON("/ingest/metrics", m))
  );

  const sent = metricResults.filter(
    (r) => r.status === "fulfilled" && r.value === true
  ).length;

  // Send heartbeat
  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  const heartbeatOk = await postJSON("/ingest/heartbeat", {
    service: CONFIG.serviceName,
    status: "healthy",
    version: CONFIG.version,
    meta: {
      uptime_seconds: uptimeSec,
      os: PLATFORM,
      arch: os.arch(),
      node_version: process.version,
      hostname: CONFIG.hostname,
    },
    tags: { host: CONFIG.hostname },
  });

  log("info", "tick", {
    metrics_sent: sent,
    metrics_total: metrics.length,
    heartbeat: heartbeatOk ? "ok" : "fail",
    uptime_seconds: uptimeSec,
  });
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function round(n, decimals = 2) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// Main Loop & Graceful Shutdown
// ─────────────────────────────────────────────

let running = true;

function shutdown(signal) {
  log("info", `received ${signal}, shutting down`);
  running = false;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function main() {
  log("info", "agent starting", {
    base_url: CONFIG.baseUrl,
    service_name: CONFIG.serviceName,
    hostname: CONFIG.hostname,
    interval_seconds: CONFIG.intervalSeconds,
    platform: PLATFORM,
    arch: os.arch(),
    node: process.version,
    pid: process.pid,
    api_key_set: CONFIG.apiKey !== "",
  });

  // Prime CPU delta on first tick (needs two samples)
  calcCpuPercent();
  getRawNetStats();
  prevNetTime = Date.now();

  while (running) {
    try {
      await collectAndSend();
    } catch (err) {
      log("error", "tick failed", { error: err.message });
    }

    // Sleep in 1-second chunks so we can respond to SIGTERM quickly
    for (let i = 0; i < CONFIG.intervalSeconds && running; i++) {
      await sleep(1000);
    }
  }

  log("info", "agent stopped");
}

main().catch((err) => {
  log("error", "fatal", { error: err.message, stack: err.stack });
  process.exit(1);
});
