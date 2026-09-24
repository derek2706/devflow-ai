# Deploy DevFlow AI to Vercel

Deploy the frontend and backend as **one Vercel project**. Next.js serves the pages and its `/api/[[...path]]` Node API route delegates requests to the existing Express app. Browser requests use `/api` on the same domain, keeping login cookies and API calls on one origin. No separate backend deployment or custom Node listener is needed.

PostgreSQL runs on a database provider. Use **Vercel Hobby** and **Supabase Free** for the requested $0 demo. Hobby is for personal, non-commercial use. Review the current [Hobby limits](https://vercel.com/docs/plans/hobby) and [Supabase plans](https://supabase.com/pricing) when signing up. Do not enable paid upgrades for this demo.

## Current deployment

Production is [devflow-ai-web-ten.vercel.app](https://devflow-ai-web-ten.vercel.app), served by `devflow-ai-web` from `codex/deploy-vercel`, with Supabase PostgreSQL. On September 24, 2026, the configuration check and migrations passed; the live health/readiness endpoints and frontend assets returned 200. Synthetic email/mobile logins returned 401, malformed requests returned 400, and untrusted origins returned 403. These checks created no accounts or application records.

The startup 500 was fixed by correcting Production's port and token lifetimes and replacing invalid JWT secrets. Environment changes require a fresh deployment. Keep the generated valid secrets for subsequent releases.

DevFlow uses its existing email/mobile authentication and Prisma database connection. `NEXT_PUBLIC_SUPABASE_URL`, a Supabase publishable key, and Supabase SSR middleware do not configure this login system. DevFlow JWT secrets are generated independently, while Prisma uses the private `DATABASE_URL`. Local accounts are not copied to the hosted database; use Sign up on the production site for an account that previously existed only locally.

## Create accounts and a database

1. Create or sign into [Vercel](https://vercel.com/signup), selecting Hobby. Complete terms and GitHub authorization yourself, granting access to `derek2706/devflow-ai`.
2. Open your existing project in the [Supabase dashboard](https://supabase.com/dashboard). Use a dedicated DevFlow database/project so existing unrelated tables cannot conflict with the application's migrations. Keep the Free plan selected.
3. Click **Connect** at the top of the project. Select **URI** as the connection format.
4. Choose **Transaction pooler** for `DATABASE_URL` (normally port **6543**). Replace `[YOUR-PASSWORD]` with your database password, URL-encoding special characters. For Prisma 6, add `?pgbouncer=true&connection_limit=1&sslmode=require` if there is no query string; otherwise append the missing parameters with `&`.
5. `DIRECT_URL` is optional for Supabase's shared transaction pooler. If missing or empty, the build derives its **Session pooler** connection by changing port **6543** to **5432**, preserving the host, credentials, database, and TLS settings, and removing `pgbouncer`, `connection_limit`, and `pool_timeout`. This works only for a valid `*.pooler.supabase.com:6543` URL. To override it, copy the **Session pooler** URI into `DIRECT_URL`, use `sslmode=require`, and omit `pgbouncer=true`. A malformed or whitespace-only override fails instead of using the fallback.
6. Enter `DATABASE_URL` and, if you chose an override, `DIRECT_URL` in Vercel's **Production** environment. These are database credentials, not a Supabase project URL, publishable/anon key, or service-role API key. Do not use `localhost` or commit the URLs. Supabase's shared session pooler supports IPv4; its direct `db.<project-ref>.supabase.co` endpoint can require IPv6 or a paid IPv4 add-on.

Supabase connection examples use placeholders only:

```text
DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
# Optional explicit migration override:
DIRECT_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
```

Copy the actual host and user from **Connect** rather than inventing them. If you do not know the database password, use Supabase's database-password reset flow yourself, then update `DATABASE_URL` and any explicit `DIRECT_URL`. The app keeps its own accounts/sessions; it uses Supabase as PostgreSQL, not Supabase Auth.

The committed security migration enables row-level security with no public policies on DevFlow's tables and revokes public/Supabase anonymous access. Prisma connects as the table owner or a backend role with `BYPASSRLS`; the application enforces member permissions. Existing Supabase APIs for unrelated tables remain unchanged. Keep the database password and Supabase service-role key server-only. See [Supabase's Prisma guide](https://supabase.com/docs/guides/database/prisma) and [pooler connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Import and configure the project

The existing Vercel project is `devflow-ai-web`, connected to [the repository](https://github.com/derek2706/devflow-ai/tree/codex/deploy-vercel). Configure that project as follows. For a fresh installation, import the same repository in [Vercel New Project](https://vercel.com/new), using the prepared `codex/deploy-vercel` branch.

| Setting                                  | Value                      |
| ---------------------------------------- | -------------------------- |
| Framework                                | Next.js                    |
| Root Directory                           | `apps/web`                 |
| Include files outside the Root Directory | Enabled                    |
| Node.js                                  | 22.x                       |
| Install and Build commands               | Use `apps/web/vercel.json` |
| Output directory                         | Next.js default            |
| Production branch                        | `codex/deploy-vercel`      |

If the initial import selects `main`, change **Settings → Environments → Production → Branch Tracking** to `codex/deploy-vercel`, then create a new production deployment from that branch's latest commit. Confirm the source branch and commit in the deployment details. Redeploying an older `main` deployment rebuilds that older commit and misses the deployment fixes. Do not promote a preview built without Production variables: the production build must run with them to apply migrations.

The monorepo setting matters because Next imports `apps/server/dist` and uses dependencies from the root lockfile. Do not create a second project for `apps/server`.

## Production environment variables

Set these for **Production** before deploying:

| Variable              | Value                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Supabase Transaction pooler URI (6543), TLS, `pgbouncer=true`, small connection limit                               |
| `DIRECT_URL`          | Optional Session pooler URI (5432) override; derived from a valid Supabase shared transaction URL when absent/empty |
| `JWT_ACCESS_SECRET`   | New random secret, at least 32 characters                                                                           |
| `JWT_REFRESH_SECRET`  | Different random secret, at least 32 characters                                                                     |
| `NEXT_PUBLIC_API_URL` | `/api`                                                                                                              |
| `AI_MODE`             | `local`                                                                                                             |
| `TRUST_VERCEL_PROXY`  | `true`                                                                                                              |

These additional variables are optional, but must contain valid values when present:

| Variable               | Recommended value | Validation                      |
| ---------------------- | ----------------- | ------------------------------- |
| `PORT`                 | `5001`            | Integer from 1 to 65535         |
| `ACCESS_TOKEN_EXPIRY`  | `15m`             | Positive duration up to one day |
| `REFRESH_TOKEN_EXPIRY` | `7d`              | Positive duration up to 90 days |

Set those values or remove the variables entirely to use their defaults. **Do not leave them blank:** an empty value fails configuration validation and makes every API endpoint return 500. `PORT` is still validated even though Vercel owns the HTTP listener. Duration units are `s`, `m`, `h`, or `d`, for example `15m` or `7d`.

Preserve the existing JWT secrets when updating this deployment. For a fresh installation, generate each JWT secret separately in your terminal:

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex') + '\n')"
```

Vercel supplies `NODE_ENV=production`, `VERCEL=1`, `VERCEL_ENV`, and domain variables. Keep system environment variables exposed to the build and runtime. The API derives its primary HTTPS origin from this trusted configuration. For your own domain, explicitly set `WEB_URL` to that exact HTTPS origin. Open the canonical production URL for login; a different deployment alias is a different origin.

Only `NEXT_PUBLIC_API_URL` belongs in the browser. Never prefix database URLs, JWT secrets, email credentials, or AI keys with `NEXT_PUBLIC_`.

## Build and verification

The local regression suite currently passes 109 tests: 79 backend, 15 Next/Express bridge, 9 migration guards, and 6 production configuration guards. The bridge tests cover startup diagnostics, generic error responses, and preservation of separate session cookies. Local test results and a successful build do not establish the hosted API's health; complete the live checks below after each release.

The build generates Prisma, compiles Express, validates API configuration, applies committed migrations, then builds Next.js with its API function. **Configuration validation and migrations run only in a Vercel Production build.** `node scripts/vercel-validate.mjs` calls the compiled backend's environment validator after the Express build and before migrations; invalid configuration stops the build with a safe error before changing the database. Preview and local builds skip this production check.

Migrations use an explicit `DIRECT_URL` or the Supabase shared-pooler fallback above. Other database providers and unsupported connection modes require an explicit migration URL. Migrations use `prisma migrate deploy` and never reset the database. They run during build, not during API requests. Migration failure stops deployment. A later build failure can leave migrations applied, so schema changes must remain compatible with the previous app release.

Once Vercel reports Ready, open its assigned HTTPS URL and check:

- `/api/health` returns HTTP 200.
- `/api/health/ready` returns HTTP 200, confirming database access.
- Sign up, create a workspace/project/task, move the task, and reload.
- Log out/in and confirm the saved board remains.
- API requests use the page's hostname.

The hosted database starts empty apart from its schema. No local accounts, `.env` files, email previews, or development database contents are uploaded.

## Preview deployments

Keep production database URLs and secrets scoped to Production. For previews, use a separate Supabase project/database and separate JWT secrets with Preview-scoped variables. The preview origin comes from Vercel's trusted deployment URL unless explicitly overridden with `WEB_URL`. Test with that immutable deployment URL; a branch alias needs its own exact `CORS_ORIGINS` entry.

Migrations are skipped for previews. Initialize that isolated database with `pnpm db:migrate`, securely setting `DATABASE_URL` to its migration URL for the command. Never point a preview at production data. A preview without database/secrets configuration is not a working app.

## What changed

- A Next Pages API route delegates native HTTP requests to the existing Express backend, preserving paths, status codes, raw request bodies, and multiple cookies.
- Startup diagnostics identify the failing stage and log only approved error identifiers and configuration key names, while clients receive a generic 500 response.
- Next's own query object is removed before Express runs, restoring Express's URL query parser and keeping catch-all route metadata out of dashboard validation. Query filters and pagination remain validated normally; `path` is reserved by Next's catch-all route and is not an application filter.
- Next's body parser is disabled for this route, retaining Express's body parsing and request-size limits.
- Prisma is reused within warm runtimes; use pooled database connections for serverless traffic.
- An additive security migration protects DevFlow tables from Supabase's public Data API while preserving backend access.
- `/api/health/ready` checks the database with a deadline and safe error response.
- Trusted Vercel client-IP handling requires an explicit opt-in and validated header.
- `scripts/vercel-migrate.mjs` applies production migrations using the migration URL and skips previews.
- `scripts/vercel-validate.mjs` validates production API configuration before migrations, reporting a fixed safe error when configuration or module loading fails.
- `apps/web/vercel.json` defines build/install commands, pins pnpm through Corepack, and selects the region.
- Next.js and Prisma were updated to patched versions. Targeted dependency overrides in `pnpm-workspace.yaml` resolve the remaining Express query parser and Prisma configuration advisories.
- Local development keeps ports 3000/5001. Next forwards local `/api` requests to the separate API; hosted builds use the integrated API route.

## Demo limits

- Local planning is deterministic and makes no paid AI calls. Provider mode requires `AI_MODE=provider`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.
- Password recovery email is **not configured** by this deployment. Add `RESEND_API_KEY` and a verified `MAIL_FROM` to enable it; the generic recovery response does not imply delivery.
- Email verification remains deferred. Invitation links are shared manually.
- Request limits live in each function instance, not globally across autoscaled instances. Add a shared limiter before broader public use.
- Free provider limits can pause service. Keep backups of data you need. Paid upgrades, domains, and external API use are separate decisions.

## Updates and troubleshooting

Vercel's Git integration normally deploys updates to the production branch automatically. For this project, verify that the release uses the latest commit on `codex/deploy-vercel`. When manually creating a production deployment, select that branch; the Redeploy action on an old `main` deployment retains its old source commit. Use isolated previews before releasing changes. A Vercel rollback changes application code, not database migrations; only roll back to compatible code. Never run `prisma migrate reset` against the hosted database.

If every API endpoint returns 500, inspect the function's runtime logs for `DevFlow AI API failure.`. Its `stage` identifies where startup or handling failed:

| Stage                    | What to check                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `environment-module`     | Compiled `apps/server/dist/config/env.js` and its dependencies are included in the deployment               |
| `environment-validation` | Variables named in `configurationKeys` have valid values in the deployment's environment                    |
| `application-module`     | Compiled Express app, dependencies, generated Prisma client, and native binaries are included               |
| `request-handling`       | An unhandled failure occurred after the app loaded; use the approved error name/code to guide investigation |

Diagnostics include only an approved error name/code, recognized configuration key names, and an approved missing-module identifier when available. They never include configuration values, raw error messages/stacks, database URLs, authorization headers, or request bodies. For `environment-validation`, check blank `PORT`, `ACCESS_TOKEN_EXPIRY`, and `REFRESH_TOKEN_EXPIRY` first when those keys are listed. JWT secrets must each contain at least 32 characters. Preserve existing valid secrets; replacing a secret affects existing sessions. After correcting environment variables, create a production deployment using the latest deployment-branch commit and repeat the health checks.

- **Dashboard rejects an unexpected `path` query key:** deploy the adapter fix that restores Express query parsing; keep the dashboard schema strict.
- **Missing backend/Prisma module:** verify the root build command and inclusion of files outside `apps/web`.
- **Migration failed:** check any explicit `DIRECT_URL`, or the supported Supabase `DATABASE_URL` fallback, TLS, database availability, and migration history. Build logs include recognized Prisma error codes such as `P1000` (credentials), `P1001` (connection), `P3005` (nonempty schema), or `P3018` (migration failure), without raw database errors or URLs.
- **Readiness 503:** check database variables and provider availability.
- **Login 403 or loops:** use the canonical HTTPS domain, `/api`, and the correct environment's `WEB_URL`.
- **Preview has no tables:** initialize its isolated database.
- **Missing recovery email:** configure the provider and verified sender.

References: [Next API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes), [Vercel monorepos](https://vercel.com/docs/monorepos), [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables), [Prisma serverless connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections).
