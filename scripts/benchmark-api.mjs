// A small, read-only latency probe. It never reads credentials or prints response bodies.
// Use browser Network timings for authenticated application endpoints as well.
const input = process.argv[2];
if (!input) {
  console.error(
    "Usage: node scripts/benchmark-api.mjs https://your-app.example",
  );
  process.exit(1);
}
const origin = new URL(input);
if (
  !["http:", "https:"].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  origin.pathname !== "/"
)
  throw new Error(
    "Provide an HTTP(S) origin without credentials, path or query.",
  );

const results = [];
for (const path of ["/api/health", "/api/health/ready"]) {
  const samples = [];
  const regions = new Set();
  for (let attempt = 0; attempt < 6; attempt++) {
    const start = performance.now();
    const response = await fetch(new URL(path, origin), {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
      redirect: "error",
    });
    await response.arrayBuffer();
    if (response.status !== 200)
      throw new Error(`${path} returned HTTP ${response.status}`);
    samples.push(Math.round(performance.now() - start));
    // Region codes only: exclude the unique request identifier.
    const region = response.headers
      .get("x-vercel-id")
      ?.split("::")
      .slice(0, -1)
      .join("::");
    if (region) regions.add(region);
  }
  const warm = samples.slice(1).sort((a, b) => a - b);
  results.push({
    path,
    firstMs: samples[0],
    warmMedianMs: warm[2],
    warmMinMs: warm[0],
    warmMaxMs: warm[4],
    regions: [...regions].join(", "),
  });
}
console.table(results);
console.log(
  "Five follow-up samples per endpoint; a small diagnostic sample, not a p95/SLA test.",
);
console.log(
  "The first request may use an already-warm function. Readiness adds a database query.",
);
