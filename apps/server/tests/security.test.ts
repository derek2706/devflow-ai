import assert from "node:assert/strict";
import { once } from "node:events";
import { test, type TestContext } from "node:test";
import type { AddressInfo } from "node:net";
import express, {
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  rateLimit,
  rateLimitClientIp,
  securityHeaders,
  verifyOrigin,
} from "../src/middlewares/security";
import { errorHandler } from "../src/shared/errors/errorHandler";
import { ApiError } from "../src/shared/errors/ApiError";

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

function proxyEnvironment(
  context: TestContext,
  flags: { TRUST_VERCEL_PROXY?: string; VERCEL?: string; NODE_ENV?: string },
) {
  const names = ["TRUST_VERCEL_PROXY", "VERCEL", "NODE_ENV"] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  for (const name of names) {
    if (flags[name] === undefined) delete process.env[name];
    else process.env[name] = flags[name];
  }
  context.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
}

function requestWithHeaders(headers: Request["headers"]): Request {
  return { headers, ip: "127.0.0.1" } as Request;
}

function limitedStatus(limiter: RequestHandler, headers: Request["headers"]) {
  let status = 200;
  limiter(
    requestWithHeaders(headers),
    { setHeader: () => undefined } as unknown as Response,
    (error?: unknown) => {
      if (error instanceof ApiError) status = error.statusCode;
    },
  );
  return status;
}

test("client-IP headers are ignored unless every Vercel trust condition is met", (context) => {
  proxyEnvironment(context, { NODE_ENV: "production", VERCEL: "1" });
  const limiter = rateLimit(1, 60_000);
  assert.equal(
    limitedStatus(limiter, { "x-vercel-forwarded-for": "203.0.113.1" }),
    200,
  );
  assert.equal(
    limitedStatus(limiter, { "x-vercel-forwarded-for": "203.0.113.2" }),
    429,
  );

  for (const flags of [
    { TRUST_VERCEL_PROXY: "false", VERCEL: "1", NODE_ENV: "production" },
    { TRUST_VERCEL_PROXY: "true", VERCEL: "0", NODE_ENV: "production" },
    { TRUST_VERCEL_PROXY: "true", VERCEL: "1", NODE_ENV: "test" },
  ]) {
    Object.assign(process.env, flags);
    assert.equal(
      rateLimitClientIp(
        requestWithHeaders({ "x-vercel-forwarded-for": "203.0.113.1" }),
      ),
      "127.0.0.1",
    );
  }
});

test("explicit Vercel ingress trust limits valid IPv4 and IPv6 clients independently", (context) => {
  proxyEnvironment(context, {
    TRUST_VERCEL_PROXY: "true",
    VERCEL: "1",
    NODE_ENV: "production",
  });
  const limiter = rateLimit(1, 60_000);
  const ipv4 = { "x-vercel-forwarded-for": "203.0.113.1" };
  const ipv6 = { "x-vercel-forwarded-for": "2001:db8::1" };
  assert.equal(limitedStatus(limiter, ipv4), 200);
  assert.equal(limitedStatus(limiter, ipv6), 200);
  assert.equal(limitedStatus(limiter, ipv4), 429);
  assert.equal(limitedStatus(limiter, ipv6), 429);
});

test("invalid, repeated, or chained Vercel client-IP headers fall back to the connection IP", (context) => {
  proxyEnvironment(context, {
    TRUST_VERCEL_PROXY: "true",
    VERCEL: "1",
    NODE_ENV: "production",
  });
  const invalid: Array<string | string[] | undefined> = [
    undefined,
    "",
    "not-an-ip",
    "203.0.113.1:443",
    "[2001:db8::1]",
    "203.0.113.1, 203.0.113.2",
    ["203.0.113.1", "203.0.113.2"],
  ];
  for (const value of invalid) {
    assert.equal(
      rateLimitClientIp(
        requestWithHeaders({ "x-vercel-forwarded-for": value }),
      ),
      "127.0.0.1",
    );
  }
  const limiter = rateLimit(1, 60_000);
  assert.equal(
    limitedStatus(limiter, { "x-vercel-forwarded-for": invalid[2] }),
    200,
  );
  assert.equal(
    limitedStatus(limiter, { "x-vercel-forwarded-for": invalid[3] }),
    429,
  );
});

test("Vercel opt-in never accepts X-Forwarded-For as a rate-limit identity", (context) => {
  proxyEnvironment(context, {
    TRUST_VERCEL_PROXY: "true",
    VERCEL: "1",
    NODE_ENV: "production",
  });
  const limiter = rateLimit(1, 60_000);
  assert.equal(
    limitedStatus(limiter, { "x-forwarded-for": "203.0.113.1" }),
    200,
  );
  assert.equal(
    limitedStatus(limiter, { "x-forwarded-for": "203.0.113.2" }),
    429,
  );
  assert.equal(
    rateLimitClientIp(
      requestWithHeaders({
        "x-vercel-forwarded-for": "2001:db8::1",
        "x-forwarded-for": "203.0.113.99",
      }),
    ),
    "2001:db8::1",
  );
});
