# API performance

The target is **200 ms or less for typical warm application requests near the deployment region**. It is a target to measure, not a guarantee for every network, cold start, password-hashing request, or external AI generation.

## What was slow

On September 25, 2026, production ran its API in Singapore (`sin1`) while the Supabase primary database was in Mumbai (`ap-south-1`). Runtime logs showed project reads around 1,994–2,247 ms, a task update at 6,815 ms, and comment reads at 2,296–6,161 ms. These are observed samples, not percentiles.

Even a readiness check that executes `SELECT 1` took about 316–381 ms inside the API. Six read-only HTTP probes from this development machine showed a warm median of 443 ms for readiness, versus 130 ms for the health route that does not query the database (five follow-up samples, excluding each endpoint's first request).

## Changes

- Run the API in Mumbai (`bom1`) beside the existing database. This changes function placement; it does not move or replace the database. Vercel recommends placing functions near their data source. See [function regions](https://vercel.com/docs/functions/configuring-functions/region).
- Validate the current session with a minimal database query. Session revocation, expiry, user ownership, and inactive-account checks still run on every protected request.
- Remove unnecessary browser requests when opening, closing, and updating a task. Refresh project summary counts when the relevant data changes.

No shared cache of private responses or permissions is introduced. Supabase and Vercel remain on their existing free plans.

## First production measurements after the change

The September 25 release (`42913e9`) responds from `bom1::bom1`, confirming that both the edge and API function are in Mumbai. The same six-request probe gave a **readiness warm median of 88 ms**, down from 443 ms, and a health warm median of 69 ms, down from 130 ms. Five follow-up samples exclude each endpoint's first request. The first health request took 1,770 ms; cold starts and outliers still matter.

Authenticated runtime logs also improved: project detail took 44 ms of server processing, workspace list requests took 16–33 ms, workspace detail took 29 ms, and dashboard requests took 78–180 ms. A project-list request took 279 ms, so the 200 ms target is not met by every request. These are a few observed requests, not a load test or percentile result. Server processing excludes browser/network/platform overhead. Post-release task writes and comment reads still need representative measurements before claiming comparable improvements for those endpoints.

## Measure a release

Run a small read-only network/database probe:

```sh
node scripts/benchmark-api.mjs https://devflow-ai-web-ten.vercel.app
```

It makes six health requests and six database-readiness requests, reporting first-request and warm follow-up durations. It does not sign in, retrieve user data, or verify authenticated endpoint performance.

For the actual application, use the browser Network panel, filter to Fetch/XHR, and measure the dashboard, workspace, project, task, and comments requests while signed in. Compare the same account and data before/after, with network throttling disabled. Distinguish a page's sequence of requests from a single request's duration. A refresh-token request after an expired session is additional work.

Vercel runtime logs already include Pino's `responseTime` in milliseconds. Compare that server duration with browser request time to distinguish application/database work from network and platform overhead. For a meaningful p95, collect enough representative traffic; a handful of manual samples is not a p95 measurement.

Do not cache authenticated API responses publicly or remove authorization checks to reach a timing target. Groq generation is a separate operation and may take seconds. Its result must identify Groq or the labelled local fallback.
