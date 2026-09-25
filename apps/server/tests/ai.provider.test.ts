import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { z } from "zod";
import { ApiError } from "../src/shared/errors/ApiError";
import {
  AiProviderFailure,
  generateWithProvider,
} from "../src/modules/ai/ai.provider";

beforeEach(() => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
    JWT_ACCESS_SECRET: "provider-test-access-secret-at-least-32-characters",
    JWT_REFRESH_SECRET: "provider-test-refresh-secret-at-least-32-characters",
    AI_MODE: "provider",
    AI_PROVIDER: "groq",
    GROQ_API_KEY: "synthetic-provider-test-key",
    GROQ_MODEL: "openai/gpt-oss-120b",
  });
});

const schema = z.object({ summary: z.string().max(5000) });
const valid = {
  status: "completed",
  output: [
    {
      type: "message",
      role: "assistant",
      content: [
        { type: "output_text", text: '{"summary":"One task remains."}' },
      ],
    },
  ],
};

test("Groq uses its fixed Responses endpoint, bounded timeout and validated strict output", async (t) => {
  const signal = new AbortController().signal;
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    assert.equal(milliseconds, 30_000);
    return signal;
  });
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.groq.com/openai/v1/responses");
    assert.equal(options.signal, signal);
    assert.equal(options.redirect, "error");
    assert.equal(
      options.headers.Authorization,
      "Bearer synthetic-provider-test-key",
    );
    const request = JSON.parse(options.body);
    assert.equal(request.store, false);
    assert.equal(request.text.format.type, "json_schema");
    assert.equal(request.text.format.strict, true);
    assert.equal(request.text.format.schema.additionalProperties, false);
    assert.deepEqual(request.text.format.schema.required, ["summary"]);
    assert.equal(request.model, "openai/gpt-oss-120b");
    assert.equal(request.max_output_tokens, 3000);
    assert.deepEqual(request.reasoning, { effort: "low" });
    assert.match(request.instructions, /untrusted data/);
    assert.deepEqual(JSON.parse(request.input), { tasks: [] });
    return new Response(JSON.stringify(valid));
  });
  assert.deepEqual(
    await generateWithProvider(schema, "summary", "Summarize", { tasks: [] }),
    { summary: "One task remains." },
  );
  assert.equal(fetch.mock.callCount(), 1);
});

for (const [name, payload] of [
  [
    "refusal",
    {
      status: "completed",
      output: [
        { type: "message", role: "assistant", content: [{ type: "refusal" }] },
      ],
    },
  ],
  ["incomplete", { status: "incomplete", output: [] }],
  [
    "non-assistant output",
    { status: "completed", output: [{ ...valid.output[0], role: "user" }] },
  ],
  [
    "invalid schema",
    {
      status: "completed",
      output: [
        {
          ...valid.output[0],
          content: [{ type: "output_text", text: '{"summary":false}' }],
        },
      ],
    },
  ],
  [
    "malformed JSON",
    {
      status: "completed",
      output: [
        {
          ...valid.output[0],
          content: [
            { type: "output_text", text: "private malformed response" },
          ],
        },
      ],
    },
  ],
] as const) {
  test(
    "Groq " + name + " is an invalid_response without raw content",
    async (t) => {
      t.mock.method(
        globalThis,
        "fetch",
        async () => new Response(JSON.stringify(payload)),
      );
      await assert.rejects(
        generateWithProvider(schema, "summary", "Summarize", {}),
        (error: unknown) => {
          assert.ok(error instanceof AiProviderFailure);
          assert.equal(error.reason, "invalid_response");
          assert.equal(
            error.message,
            "The AI provider response could not be verified.",
          );
          assert.ok(!error.message.includes("private"));
          return true;
        },
      );
    },
  );
}

test("quota, outage and upstream timeouts retain typed recoverable reasons", async (t) => {
  let status = 429;
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("private upstream credentials", { status }),
  );
  for (const [code, reason] of [
    [402, "quota"],
    [429, "quota"],
    [408, "timeout"],
    [504, "timeout"],
    [500, "unavailable"],
    [503, "unavailable"],
  ] as const) {
    status = code;
    await assert.rejects(
      generateWithProvider(schema, "summary", "Summarize", {}),
      (error: unknown) => {
        assert.ok(error instanceof AiProviderFailure);
        assert.equal(error.reason, reason);
        assert.ok(!error.message.includes("private"));
        return true;
      },
    );
  }
  assert.equal(fetch.mock.callCount(), 6);
});

test("credential and request configuration failures never become fallback reasons", async (t) => {
  let status = 401;
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("private model or key", { status }),
  );
  for (const code of [400, 401, 403, 404]) {
    status = code;
    await assert.rejects(
      generateWithProvider(schema, "summary", "Summarize", {}),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.ok(!(error instanceof AiProviderFailure));
        assert.ok(!error.message.includes("private"));
        return true;
      },
    );
  }
});

test("transport failures and aborted response bodies are sanitized and classified", async (t) => {
  let failure: Error = new TypeError("private transport detail");
  t.mock.method(globalThis, "fetch", async () => {
    throw failure;
  });
  for (const [error, reason] of [
    [new TypeError("private transport detail"), "unavailable"],
    [new DOMException("private timed-out details", "TimeoutError"), "timeout"],
    [new DOMException("private aborted details", "AbortError"), "timeout"],
  ] as const) {
    failure = error;
    await assert.rejects(
      generateWithProvider(schema, "summary", "Summarize", {}),
      (value: unknown) =>
        value instanceof AiProviderFailure &&
        value.reason === reason &&
        !value.message.includes("private"),
    );
  }
});

test("a body timeout remains a timeout rather than malformed output", async (t) => {
  const response = new Response("{}");
  t.mock.method(response, "json", async () => {
    throw new DOMException("private body timeout", "TimeoutError");
  });
  t.mock.method(globalThis, "fetch", async () => response);
  await assert.rejects(
    generateWithProvider(schema, "summary", "Summarize", {}),
    (error: unknown) =>
      error instanceof AiProviderFailure && error.reason === "timeout",
  );
});

test("missing or malformed credentials fail before any provider request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected request");
  });
  delete process.env.GROQ_API_KEY;
  await assert.rejects(
    generateWithProvider(schema, "summary", "Summarize", {}),
    /GROQ_API_KEY/,
  );
  process.env.GROQ_API_KEY = "invalid internal space";
  await assert.rejects(
    generateWithProvider(schema, "summary", "Summarize", {}),
    /GROQ_API_KEY/,
  );
  assert.equal(fetch.mock.callCount(), 0);
});
