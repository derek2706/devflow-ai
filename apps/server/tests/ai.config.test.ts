import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { getEnv } from "../src/config/env";

const original = { ...process.env };
beforeEach(() => {
  for (const key of [
    "AI_PROVIDER",
    "AI_GATEWAY_MODEL",
    "AI_GATEWAY_API_KEY",
    "VERCEL_OIDC_TOKEN",
    "GROQ_API_KEY",
    "GROQ_MODEL",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "VERCEL",
  ])
    delete process.env[key];
  Object.assign(process.env, {
    NODE_ENV: "test",
    WEB_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
    JWT_ACCESS_SECRET: "config-test-access-secret-at-least-32-characters",
    JWT_REFRESH_SECRET: "config-test-refresh-secret-at-least-32-characters",
    AI_MODE: "local",
  });
});
after(() => {
  for (const key of Object.keys(process.env))
    if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
});

test("local planner needs no credentials and defaults to Groq for provider mode", () => {
  assert.equal(getEnv().AI_MODE, "local");
  assert.equal(getEnv().AI_PROVIDER, "groq");
  assert.equal(getEnv().GROQ_MODEL, "openai/gpt-oss-120b");
});

test("unused legacy provider keys are ignored and cannot select an external service", () => {
  process.env.OPENAI_API_KEY = "synthetic-unused-key";
  process.env.OPENAI_MODEL = "synthetic-unused-model";
  process.env.AI_GATEWAY_API_KEY = "synthetic-unused-key";
  const env = getEnv();
  assert.equal(env.AI_MODE, "local");
  assert.equal("OPENAI_API_KEY" in env, false);
  assert.equal("OPENAI_MODEL" in env, false);
  assert.equal("AI_GATEWAY_API_KEY" in env, false);
});

test("Groq requires only its selected provider credentials and rejects blank model/key", () => {
  process.env.AI_MODE = "provider";
  process.env.AI_PROVIDER = "groq";
  process.env.GROQ_API_KEY = "  ";
  assert.throws(() => getEnv(), /GROQ_API_KEY/);
  process.env.GROQ_API_KEY = "synthetic-groq-key";
  assert.equal(getEnv().GROQ_MODEL, "openai/gpt-oss-120b");
  process.env.GROQ_MODEL = "";
  assert.throws(() => getEnv(), /GROQ_MODEL/);
});

test("provider mode requires its Groq key on Vercel as well as locally", () => {
  process.env.AI_MODE = "provider";
  process.env.VERCEL = "1";
  assert.throws(() => getEnv(), /GROQ_API_KEY/);
  process.env.GROQ_API_KEY = "synthetic-groq-key";
  assert.equal(getEnv().AI_PROVIDER, "groq");
});

test("malformed credential headers are configuration errors without leaking values", () => {
  for (const value of [
    "synthetic key",
    "synthetic\r\nkey",
    "synthetic\u007fkey",
  ]) {
    process.env.GROQ_API_KEY = value;
    assert.throws(
      () => getEnv(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /GROQ_API_KEY/);
        assert.ok(!error.message.includes("synthetic"));
        return true;
      },
    );
  }
});

test("unselected providers fail with field names only", () => {
  process.env.AI_PROVIDER = "private-provider-value";
  assert.throws(
    () => getEnv(),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /AI_PROVIDER/);
      assert.ok(!error.message.includes("private-provider-value"));
      return true;
    },
  );
  for (const provider of ["gateway", "openai", ""]) {
    process.env.AI_PROVIDER = provider;
    assert.throws(() => getEnv(), /AI_PROVIDER/);
  }
});
