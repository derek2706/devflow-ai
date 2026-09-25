import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, mock, test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { AuthProvider } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma";
import { mailer, MailMessage } from "../src/lib/mail";
import { authRoutes } from "../src/modules/auth";
import authRepository from "../src/modules/auth/auth.repository";
import { accessToken } from "../src/modules/auth/auth.tokens";
import { errorHandler } from "../src/shared/errors/errorHandler";

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  JWT_ACCESS_SECRET: "test-only-access-secret-at-least-thirty-two-characters",
  JWT_REFRESH_SECRET: "test-only-refresh-secret-at-least-thirty-two-characters",
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",
  WEB_URL: "http://localhost:3000",
  API_COOKIE_SECURE: "false",
  AI_MODE: "local",
});

const password = "Password@123";
const email = "login-test@example.com";
const mobileNumber = "9876543210";
const userId = "6d485a35-cfb8-4c5d-8d93-1ceae41d9cda";
const users = new Map<string, any>();
const authentications = new Map<string, any>();
const sessions = new Map<string, any>();
const resets = new Map<string, any>();
const messages: MailMessage[] = [];
let passwordHash: string;
let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;
let lookupCount = 0;

before(async () => {
  passwordHash = await bcrypt.hash(password, 4);
  mock.method(authRepository, "transaction", async (_db: any, callback: any) =>
    callback(prisma),
  );
  mock.method(authRepository, "lockUser", async () => {});
  mock.method(
    authRepository,
    "findAuthentication",
    async (_db: any, provider: string, identifier: string) => {
      lookupCount += 1;
      return authentications.get(`${provider}:${identifier}`) ?? null;
    },
  );
  mock.method(
    authRepository,
    "findUser",
    async (_db: any, id: string) => users.get(id) ?? null,
  );
  mock.method(authRepository, "createUser", async (_db: any, data: any) => {
    const user = { id: randomUUID(), avatar: null, isActive: true, ...data };
    users.set(user.id, user);
    return user;
  });
  mock.method(
    authRepository,
    "createAuthentication",
    async (_db: any, data: any) => {
      const record = {
        id: randomUUID(),
        ...data,
        user: users.get(data.userId),
      };
      authentications.set(`${data.provider}:${data.identifier}`, record);
      return record;
    },
  );
  mock.method(authRepository, "createSession", async (_db: any, data: any) => {
    const record = { revokedAt: null, ...data, user: users.get(data.userId) };
    sessions.set(record.id, record);
    return record;
  });
  mock.method(
    authRepository,
    "findSession",
    async (_db: any, id: string) => sessions.get(id) ?? null,
  );
  mock.method(
    authRepository,
    "findActiveSession",
    async (_db: any, id: string, userId: string) => {
      const session = sessions.get(id);
      return session &&
        session.userId === userId &&
        !session.revokedAt &&
        session.expiresAt > new Date() &&
        users.get(userId)?.isActive
        ? { id: session.id }
        : null;
    },
  );
  mock.method(
    authRepository,
    "rotateSession",
    async (_db: any, id: string, previousHash: string, nextHash: string) => {
      const session = sessions.get(id);
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.refreshTokenHash !== previousHash
      )
        return { count: 0 };
      session.refreshTokenHash = nextHash;
      return { count: 1 };
    },
  );
  mock.method(authRepository, "revokeSession", async (_db: any, id: string) => {
    const session = sessions.get(id);
    if (!session) return { count: 0 };
    session.revokedAt = new Date();
    return { count: 1 };
  });
  mock.method(
    authRepository,
    "revokeUserSessions",
    async (_db: any, id: string) => {
      let count = 0;
      for (const session of sessions.values())
        if (session.userId === id) {
          session.revokedAt = new Date();
          count++;
        }
      return { count };
    },
  );
  mock.method(
    authRepository,
    "createPasswordReset",
    async (_db: any, data: any) => {
      const reset = {
        id: randomUUID(),
        usedAt: null,
        ...data,
        user: users.get(data.userId),
      };
      resets.set(reset.id, reset);
      return reset;
    },
  );
  mock.method(
    authRepository,
    "findPasswordReset",
    async (_db: any, tokenHash: string) =>
      [...resets.values()].find((reset) => reset.tokenHash === tokenHash) ??
      null,
  );
  mock.method(
    authRepository,
    "consumePasswordReset",
    async (_db: any, id: string) => {
      const reset = resets.get(id);
      if (!reset || reset.usedAt || reset.expiresAt <= new Date())
        return { count: 0 };
      reset.usedAt = new Date();
      return { count: 1 };
    },
  );
  mock.method(
    authRepository,
    "invalidatePasswordResets",
    async (_db: any, userId: string) => {
      let count = 0;
      for (const reset of resets.values())
        if (reset.userId === userId && !reset.usedAt) {
          reset.usedAt = new Date();
          count++;
        }
      return { count };
    },
  );
  mock.method(
    authRepository,
    "updatePassword",
    async (_db: any, userId: string, hash: string) => {
      let count = 0;
      for (const authentication of authentications.values())
        if (authentication.userId === userId) {
          authentication.passwordHash = hash;
          count++;
        }
      return { count };
    },
  );
  mock.method(mailer, "send", async (message: MailMessage) => {
    messages.push(message);
  });
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  users.clear();
  authentications.clear();
  sessions.clear();
  resets.clear();
  messages.length = 0;
  lookupCount = 0;
  const user = {
    id: userId,
    name: "Test Developer",
    avatar: null,
    isActive: true,
  };
  users.set(userId, user);
  for (const [provider, identifier] of [
    [AuthProvider.EMAIL, email],
    [AuthProvider.MOBILE, mobileNumber],
  ]) {
    authentications.set(`${provider}:${identifier}`, {
      id: randomUUID(),
      provider,
      identifier,
      passwordHash,
      userId,
      user,
    });
  }
});

after(async () => {
  mock.restoreAll();
  if (server?.listening)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  await prisma.$disconnect();
});

async function request(
  path: string,
  body?: Record<string, unknown>,
  cookie?: string,
) {
  const response = await fetch(`${baseUrl}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    response,
    body: await response.json(),
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  };
}
const login = (body: Record<string, unknown> = { email, password }) =>
  request("/login", body);

for (const [provider, identifier] of [
  ["email", { email }],
  ["mobile", { mobileNumber }],
] as const) {
  test(`valid ${provider} credentials return a safe user and HttpOnly cookies`, async () => {
    const result = await login({ ...identifier, password });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.data, {
      user: { id: userId, name: "Test Developer", avatar: null },
    });
    const cookies = result.response.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    assert.ok(
      cookies.every(
        (cookie) =>
          cookie.includes("HttpOnly") && cookie.includes("SameSite=Lax"),
      ),
    );
    assert.equal(sessions.size, 1);
    assert.ok(!JSON.stringify(result.body).includes("password"));
    assert.ok(!JSON.stringify(result.body).includes("Token"));
  });
}

test("email is normalized before lookup", async () => {
  assert.equal(
    (await login({ email: "  LOGIN-test@EXAMPLE.com ", password })).response
      .status,
    200,
  );
});

test("wrong passwords, unknown accounts, and inactive users return identical failures", async () => {
  for (const attempt of [
    { email, password: "WrongPassword" },
    { email: "unknown@example.com", password },
    { mobileNumber, password: "WrongPassword" },
    { mobileNumber: "9876543211", password },
  ]) {
    const result = await login(attempt);
    assert.equal(result.response.status, 401);
    assert.deepEqual(result.body, {
      success: false,
      message: "Invalid credentials",
    });
    assert.equal(result.response.headers.get("set-cookie"), null);
  }
  users.get(userId).isActive = false;
  const inactive = await login();
  assert.equal(inactive.response.status, 401);
  assert.deepEqual(inactive.body, {
    success: false,
    message: "Invalid credentials",
  });
});

test("passwords are compared without trimming", async () => {
  assert.equal(
    (await login({ email, password: ` ${password} ` })).response.status,
    401,
  );
});

const invalidRequests: Array<[string, Record<string, unknown>]> = [
  ["missing identifier", { password }],
  ["both identifiers", { email, mobileNumber, password }],
  ["malformed email", { email: "invalid-email", password }],
  ["malformed mobile", { mobileNumber: "12345", password }],
  ["missing password", { email }],
  ["empty password", { email, password: "" }],
  ["non-string password", { email, password: 12345678 }],
];
for (const [description, body] of invalidRequests)
  test(`${description} is rejected before lookup`, async () => {
    const result = await login(body);
    assert.equal(result.response.status, 400);
    assert.ok(result.body.errors.length > 0);
    assert.equal(lookupCount, 0);
  });

test("registration enforces XOR identifiers and bcrypt's 72-byte password limit", async () => {
  for (const body of [
    { name: "New Developer", email, mobileNumber, password },
    {
      name: "New Developer",
      email: "new@example.com",
      password: "é".repeat(37),
    },
  ]) {
    assert.equal((await request("/register", body)).response.status, 400);
  }
});

test("registration persists a hash and starts a session", async () => {
  const result = await request("/register", {
    name: "New Developer",
    email: "NEW@example.com",
    password,
  });
  assert.equal(result.response.status, 201);
  const record = authentications.get("EMAIL:new@example.com");
  assert.notEqual(record.passwordHash, password);
  assert.ok(await bcrypt.compare(password, record.passwordHash));
  assert.equal(
    (await request("/me", undefined, result.cookie)).body.data.user.name,
    "New Developer",
  );
});

test("duplicate registration returns conflict", async () => {
  assert.equal(
    (await request("/register", { name: "Duplicate", email, password }))
      .response.status,
    409,
  );
});

test("me requires a valid active session", async () => {
  assert.equal((await request("/me")).response.status, 401);
  const signedIn = await login();
  assert.equal(
    (await request("/me", undefined, signedIn.cookie)).response.status,
    200,
  );
  users.get(userId).isActive = false;
  assert.equal(
    (await request("/me", undefined, signedIn.cookie)).response.status,
    401,
  );
});

test("valid access tokens cannot use an expired or different user's session", async () => {
  const signedIn = await login();
  const session = [...sessions.values()][0];
  const validExpiry = session.expiresAt;
  session.expiresAt = new Date(0);
  assert.equal(
    (await request("/me", undefined, signedIn.cookie)).response.status,
    401,
  );
  session.expiresAt = validExpiry;
  const otherUserId = randomUUID();
  users.set(otherUserId, {
    id: otherUserId,
    name: "Another active user",
    avatar: null,
    isActive: true,
  });
  const mismatched = accessToken(otherUserId, session.id);
  assert.equal(
    (await request("/me", undefined, `access_token=${mismatched}`)).response
      .status,
    401,
  );
  assert.equal(
    (await request("/me", undefined, signedIn.cookie)).response.status,
    200,
  );
});

test("refresh rotates credentials and replay revokes the session", async () => {
  const signedIn = await login();
  const oldHash = [...sessions.values()][0].refreshTokenHash;
  const refreshed = await request("/refresh", {}, signedIn.cookie);
  assert.equal(refreshed.response.status, 200);
  assert.notEqual(refreshed.cookie, signedIn.cookie);
  assert.notEqual([...sessions.values()][0].refreshTokenHash, oldHash);
  assert.equal(
    (await request("/refresh", {}, signedIn.cookie)).response.status,
    401,
  );
  assert.equal(
    (await request("/me", undefined, refreshed.cookie)).response.status,
    401,
  );
});

test("expired refresh sessions cannot be renewed", async () => {
  const signedIn = await login();
  [...sessions.values()][0].expiresAt = new Date(0);
  assert.equal(
    (await request("/refresh", {}, signedIn.cookie)).response.status,
    401,
  );
});

test("logout immediately revokes access and refresh and is idempotent", async () => {
  const signedIn = await login();
  const loggedOut = await request("/logout", {}, signedIn.cookie);
  assert.equal(loggedOut.response.status, 200);
  assert.ok(
    loggedOut.response.headers
      .getSetCookie()
      .every((cookie) => cookie.includes("Expires=Thu, 01 Jan 1970")),
  );
  assert.equal(
    (await request("/me", undefined, signedIn.cookie)).response.status,
    401,
  );
  assert.equal(
    (await request("/refresh", {}, signedIn.cookie)).response.status,
    401,
  );
  assert.equal((await request("/logout", {})).response.status, 200);
});

test("forgot-password responses do not disclose whether an account exists", async () => {
  const known = await request("/forgot-password", { email });
  const unknown = await request("/forgot-password", {
    email: "unknown@example.com",
  });
  assert.deepEqual(known.body, unknown.body);
  assert.equal(known.response.status, unknown.response.status);
  assert.equal(messages.length, 1);
  const stored = [...resets.values()][0];
  assert.equal(stored.tokenHash.length, 64);
  assert.ok(!JSON.stringify(known.body).includes(stored.tokenHash));
});

test("password reset is single-use, changes password, and revokes every session", async () => {
  const first = await login();
  const second = await login();
  await request("/forgot-password", { email });
  const url = messages[0].text.match(
    /http:\/\/localhost:3000\/reset-password\?token=([A-Za-z0-9_-]+)/,
  )!;
  const token = url[1];
  const nextPassword = "ChangedPassword@123";
  assert.equal(
    (await request("/reset-password", { token, password: nextPassword }))
      .response.status,
    200,
  );
  assert.equal(
    (await request("/reset-password", { token, password: nextPassword }))
      .response.status,
    400,
  );
  assert.equal(
    (await request("/me", undefined, first.cookie)).response.status,
    401,
  );
  assert.equal(
    (await request("/me", undefined, second.cookie)).response.status,
    401,
  );
  assert.equal((await login()).response.status, 401);
  assert.equal(
    (await login({ email, password: nextPassword })).response.status,
    200,
  );
});

test("an expired password reset cannot change credentials", async () => {
  await request("/forgot-password", { email });
  const token = messages[0].text.match(/token=([A-Za-z0-9_-]+)/)![1];
  [...resets.values()][0].expiresAt = new Date(0);
  assert.equal(
    (
      await request("/reset-password", {
        token,
        password: "ChangedPassword@123",
      })
    ).response.status,
    400,
  );
  assert.equal((await login()).response.status, 200);
});

test("malformed JSON is a safe 400 response", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{broken",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Invalid JSON request body",
  });
});

test("login cannot create a session with credentials changed during password comparison", async () => {
  const lock = mock.method(authRepository, "lockUser", async () => {
    authentications.get(`EMAIL:${email}`).passwordHash = await bcrypt.hash(
      "ReplacedPassword@123",
      4,
    );
  });
  try {
    const result = await login();
    assert.equal(result.response.status, 401);
    assert.deepEqual(result.body, {
      success: false,
      message: "Invalid credentials",
    });
    assert.equal(sessions.size, 0);
  } finally {
    lock.mock.restore();
  }
});
