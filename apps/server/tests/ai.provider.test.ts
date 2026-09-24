import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { generateWithProvider } from "../src/modules/ai/ai.provider";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET =
  "provider-test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET =
  "provider-test-refresh-secret-at-least-32-characters";
process.env.AI_MODE = "provider";
process.env.OPENAI_API_KEY = "synthetic-provider-test-key";
process.env.OPENAI_MODEL = "test-model";

const schema = z.object({ summary: z.string() });
test("provider uses structured output with storage disabled and validates the result", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const request = JSON.parse(options.body);
    assert.equal(request.store, false);
    assert.equal(request.text.format.type, "json_schema");
    assert.equal(request.text.format.strict, true);
    assert.equal(request.model, "test-model");
    assert.match(request.instructions, /untrusted data/);
    return new Response(
      JSON.stringify({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ summary: "One task remains." }),
              },
            ],
          },
        ],
      }),
    );
  });
  assert.deepEqual(
    await generateWithProvider(schema, "summary", "Summarize", { tasks: [] }),
    { summary: "One task remains." },
  );
});

for (const [name, body] of [
  [
    "refusal",
    {
      status: "completed",
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "No" }] },
      ],
    },
  ],
  ["incomplete", { status: "incomplete", output: [] }],
  [
    "invalid schema",
    {
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"summary":false}' }],
        },
      ],
    },
  ],
] as const) {
  test(`provider ${name} returns a safe error`, async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify(body)),
    );
    await assert.rejects(
      generateWithProvider(schema, "summary", "Summarize", {}),
      {
        statusCode: 502,
        message:
          "The AI provider could not produce a valid result. Please try again.",
      },
    );
  });
}

test("provider transport failures do not leak credential or upstream details", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("secret upstream detail");
  });
  await assert.rejects(
    generateWithProvider(schema, "summary", "Summarize", {}),
    {
      statusCode: 502,
      message:
        "The AI provider could not produce a valid result. Please try again.",
    },
  );
});
