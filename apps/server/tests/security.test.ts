import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  rateLimit,
  securityHeaders,
  verifyOrigin,
} from "../src/middlewares/security";
import { errorHandler } from "../src/shared/errors/errorHandler";

process.env.NODE_ENV = "test";
process.env.WEB_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET =
  "security-test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET =
  "security-test-refresh-secret-at-least-32-characters";

test("browser write origins are checked and API responses cannot be cached", async () => {
  const app = express();
  app.use(securityHeaders, verifyOrigin);
  app.post("/write", (_req, res) => res.json({ success: true }));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/write`;
  try {
    const rejected = await fetch(url, {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(rejected.status, 403);
    const allowed = await fetch(url, {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    assert.equal(allowed.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await fetch(url, { method: "POST" })).status, 200);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
});

test("request limits reject excess attempts and cannot be bypassed by an untrusted forwarding header", async () => {
  const app = express();
  app.use(rateLimit(2, 60_000));
  app.get("/", (_req, res) => res.json({ success: true }));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  try {
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 200);
    const rejected = await fetch(url, {
      headers: { "X-Forwarded-For": "203.0.113.1" },
    });
    assert.equal(rejected.status, 429);
    assert.ok(Number(rejected.headers.get("retry-after")) > 0);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
});
