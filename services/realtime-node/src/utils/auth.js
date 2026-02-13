"use strict";

const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "";

/**
 * Zero-dependency HMAC-SHA256 JWT verification.
 * Supports tokens in query string (?token=xxx) as either:
 *   - a JWT (header.payload.signature) when JWT_SECRET is set
 *   - a plain API key matching API_KEY env var
 *
 * Returns the decoded payload object on success, or null on failure.
 * If no auth is configured (no JWT_SECRET and no API_KEY), returns { sub: "anonymous" }.
 */
function verifyToken(url) {
  let token;
  try {
    const parsed = new URL(url, "http://localhost");
    token = parsed.searchParams.get("token");
  } catch {
    return null;
  }

  // No auth configured — allow all
  if (!JWT_SECRET && !process.env.API_KEY) {
    return { sub: "anonymous" };
  }

  if (!token) return null;

  // Try JWT first if JWT_SECRET is set
  if (JWT_SECRET) {
    const payload = verifyJWT(token);
    if (payload) return payload;
  }

  // Fallback to plain API key
  if (process.env.API_KEY && token === process.env.API_KEY) {
    return { sub: "api_key" };
  }

  return null;
}

/**
 * Verify an HS256 JWT token without external dependencies.
 * Returns the decoded payload on success, or null on failure.
 */
function verifyJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature
  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac("sha256", JWT_SECRET).update(data).digest(),
  );

  if (
    !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signatureB64))
  ) {
    return null;
  }

  // Decode header — only support HS256
  try {
    const header = JSON.parse(base64UrlDecode(headerB64));
    if (header.alg !== "HS256") return null;
  } catch {
    return null;
  }

  // Decode payload and check expiry
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));

    // Check expiration if present
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

module.exports = { verifyToken, verifyJWT };
