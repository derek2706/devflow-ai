import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { durationMs, getEnv } from "../src/config/env";

const original = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    CORS_ORIGINS: "",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    JWT_ACCESS_SECRET:
      "config-test-access-secret-at-least-thirty-two-characters",
    JWT_REFRESH_SECRET:
      "config-test-refresh-secret-at-least-thirty-two-characters",
    ACCESS_TOKEN_EXPIRY: "15m",
    REFRESH_TOKEN_EXPIRY: "7d",
    AI_MODE: "local",
  });
});
after(() => {
  for (const key of Object.keys(process.env))
    if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
});

test("token lifetimes must be positive, finite, and bounded", () => {
  for (const value of [
    "0s",
    "-1h",
    "1.5h",
    "999999999999999999999999999999999999999999d",
    "2d",
  ]) {
    process.env.ACCESS_TOKEN_EXPIRY = value;
    assert.throws(() => getEnv(), /ACCESS_TOKEN_EXPIRY/);
  }
  process.env.ACCESS_TOKEN_EXPIRY = "1d";
  process.env.REFRESH_TOKEN_EXPIRY = "90d";
  assert.equal(durationMs(getEnv().ACCESS_TOKEN_EXPIRY), 86_400_000);
  process.env.REFRESH_TOKEN_EXPIRY = "91d";
  assert.throws(() => getEnv(), /REFRESH_TOKEN_EXPIRY/);
});

test("configuration errors identify fields without disclosing values", () => {
  process.env.JWT_ACCESS_SECRET = "secret-must-not-leak";
  assert.throws(
    () => getEnv(),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /JWT_ACCESS_SECRET/);
      assert.ok(!error.message.includes("secret-must-not-leak"));
      return true;
    },
  );
});

test("additional CORS origins accept comma-separated HTTP(S) origins and normalize them", () => {
  process.env.CORS_ORIGINS =
    "  http://localhost:2000 , https://app.example.com:443/  ";
  assert.deepEqual(getEnv().CORS_ORIGINS, [
    "http://localhost:2000",
    "https://app.example.com",
  ]);
  process.env.CORS_ORIGINS = "";
  assert.deepEqual(getEnv().CORS_ORIGINS, []);
});

test("additional CORS origins reject wildcards, credentials, non-HTTP protocols, and URL suffixes", () => {
  for (const origin of [
    "*",
    "https://user:password@app.example.com",
    "ftp://app.example.com",
    "javascript:alert(1)",
    "https://app.example.com/path",
    "https://app.example.com?query=1",
    "https://app.example.com#section",
  ]) {
    process.env.CORS_ORIGINS = origin;
    assert.throws(() => getEnv(), /CORS_ORIGINS/);
  }
});
