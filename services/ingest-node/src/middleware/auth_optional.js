"use strict";

/**
 * Optional API-key auth check (non-Express).
 * If API_KEY is set, validates the x-api-key header.
 * Returns true if the request may proceed, false if rejected.
 */
function checkAuth(req, res, env) {
  if (!env.API_KEY) return true;

  const key = req.headers["x-api-key"];
  if (key === env.API_KEY) return true;

  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "unauthorized",
      message: "invalid or missing API key",
    }),
  );
  return false;
}

module.exports = { checkAuth };
