import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { durationMs, getEnv } from "../src/config/env";
import { isAllowedOrigin } from "../src/config/origins";

const original = { ...process.env };
beforeEach(() => {
  for (const name of [
    "WEB_URL",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ])
    delete process.env[name];
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
    TRUST_VERCEL_PROXY: "false",
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

test("Vercel proxy trust requires an explicit validated opt-in", () => {
  delete process.env.TRUST_VERCEL_PROXY;
  assert.equal(getEnv().TRUST_VERCEL_PROXY, "false");
  process.env.TRUST_VERCEL_PROXY = "true";
  assert.equal(getEnv().TRUST_VERCEL_PROXY, "true");
  process.env.TRUST_VERCEL_PROXY = "yes";
  assert.throws(() => getEnv(), /TRUST_VERCEL_PROXY/);
});

test("Vercel origin metadata is ignored outside the production Vercel runtime", () => {
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "production.example.com";
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL = "1";
  assert.equal(getEnv().WEB_URL, "http://localhost:3000");
  process.env.NODE_ENV = "production";
  delete process.env.VERCEL;
  assert.equal(getEnv().WEB_URL, "http://localhost:3000");
});

test("Vercel production and preview origins use their exact trusted deployment metadata", () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "production.example.com",
    VERCEL_URL: "devflow-preview-123.vercel.app",
  });
  assert.equal(getEnv().WEB_URL, "https://production.example.com");
  assert.equal(isAllowedOrigin("https://production.example.com"), true);
  assert.equal(
    isAllowedOrigin("https://devflow-preview-123.vercel.app"),
    false,
  );

  process.env.VERCEL_ENV = "preview";
  assert.equal(getEnv().WEB_URL, "https://devflow-preview-123.vercel.app");
  assert.equal(isAllowedOrigin("https://devflow-preview-123.vercel.app"), true);
  assert.equal(isAllowedOrigin("https://production.example.com"), false);
  assert.equal(isAllowedOrigin("https://another-preview.vercel.app"), false);
});

test("an explicit HTTPS custom origin wins and extra origins require an exact allowlist entry", () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "production.example.com",
    WEB_URL: "https://custom.example.com:443/",
    CORS_ORIGINS: "https://approved.example.com",
  });
  assert.equal(getEnv().WEB_URL, "https://custom.example.com");
  assert.equal(isAllowedOrigin("https://custom.example.com"), true);
  assert.equal(isAllowedOrigin("https://approved.example.com"), true);
  assert.equal(isAllowedOrigin("https://production.example.com"), false);
  assert.equal(isAllowedOrigin("https://unapproved.vercel.app"), false);
});

test("Vercel rejects missing or malformed host metadata without exposing its value", () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
  });
  assert.throws(() => getEnv(), /WEB_URL/);
  for (const hostname of [
    "https://private-value.example",
    "private-value.example/path",
    "user:password@private-value.example",
    "private-value.example:443",
    "private-value.example?token=secret",
    " private-value.example",
    "*.private-value.example",
    "127.0.0.1",
  ]) {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = hostname;
    assert.throws(
      () => getEnv(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /WEB_URL/);
        assert.ok(!error.message.includes(hostname));
        return true;
      },
    );
  }
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "production.example.com";
  process.env.VERCEL_ENV = "preview";
  assert.throws(() => getEnv(), /WEB_URL/);
});

test("Vercel browser origins require HTTPS even when explicitly configured", () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    VERCEL: "1",
    WEB_URL: "http://app.example.com",
  });
  assert.throws(() => getEnv(), /WEB_URL must use HTTPS/);
  process.env.WEB_URL = "https://app.example.com";
  process.env.CORS_ORIGINS = "http://another.example.com";
  assert.throws(() => getEnv(), /CORS_ORIGINS must use HTTPS/);
});
