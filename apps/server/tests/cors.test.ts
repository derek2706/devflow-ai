import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";

const allowedOrigin = "http://localhost:3000";
let server: Server;
let baseUrl: string;

before(async () => {
  // Keep this suite independent of local credentials and external services.
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1:5432/unused",
    WEB_URL: allowedOrigin,
    CORS_ORIGINS: "",
    JWT_ACCESS_SECRET: "cors-test-access-secret-at-least-thirty-two-characters",
    JWT_REFRESH_SECRET:
      "cors-test-refresh-secret-at-least-thirty-two-characters",
    ACCESS_TOKEN_EXPIRY: "15m",
    REFRESH_TOKEN_EXPIRY: "7d",
    API_COOKIE_SECURE: "false",
    AI_MODE: "local",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
    RESEND_API_KEY: "",
  });
  const { default: app } = await import("../src/app");
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  process.env.CORS_ORIGINS = "";
});

after(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
});

function assertCredentialedCors(response: Response, origin = allowedOrigin) {
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(
    response.headers.get("access-control-allow-credentials"),
    "true",
  );
  assert.match(response.headers.get("vary") ?? "", /(?:^|,\s*)Origin(?:,|$)/i);
}

for (const path of ["/api/auth/login", "/api/workspaces"]) {
  test(`allowed credentialed POST preflight succeeds before authentication at ${path}`, async () => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.equal(response.status, 204);
    assertCredentialedCors(response);
    assert.ok(
      response.headers
        .get("access-control-allow-methods")
        ?.split(",")
        .includes("POST"),
    );
    assert.equal(
      response.headers.get("access-control-allow-headers"),
      "content-type",
    );
    assert.equal(await response.text(), "");
  });
}

test("allowed-origin validation failures retain credentialed CORS headers", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { Origin: allowedOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "unused" }),
  });
  assert.equal(response.status, 400);
  assertCredentialedCors(response);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.ok(body.errors.length > 0);
});

test("allowed-origin unauthenticated domain responses retain credentialed CORS headers", async () => {
  const response = await fetch(`${baseUrl}/api/workspaces`, {
    headers: { Origin: allowedOrigin },
  });
  assert.equal(response.status, 401);
  assertCredentialedCors(response);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Authentication required",
  });
});

for (const origin of ["https://untrusted.example", "http://localhost:2000"]) {
  test(`unconfigured origin ${origin} cannot preflight or write`, async () => {
    const preflight = await fetch(`${baseUrl}/api/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.notEqual(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), null);
    assert.equal(
      preflight.headers.get("access-control-allow-credentials"),
      null,
    );

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "unused" }),
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Request origin is not allowed",
    });
  });
}

test("an explicitly configured additional origin can preflight and write while other origins remain denied", async () => {
  const previewOrigin = "http://localhost:2000";
  process.env.CORS_ORIGINS = previewOrigin;
  const preflight = await fetch(`${baseUrl}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: previewOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assertCredentialedCors(preflight, previewOrigin);

  // Invalid input reaches validation (400), rather than the origin guard (403).
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { Origin: previewOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "unused" }),
  });
  assert.equal(response.status, 400);
  assertCredentialedCors(response, previewOrigin);

  const primary = await fetch(`${baseUrl}/api/workspaces`, {
    headers: { Origin: allowedOrigin },
  });
  assert.equal(primary.status, 401);
  assertCredentialedCors(primary);

  const rejected = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);
});
