# Deploy DevFlow AI to Vercel

Deploy the frontend and backend as **one Vercel project**. Next.js serves the pages and its `/api/[[...path]]` Node API route delegates requests to the existing Express app. Browser requests use `/api` on the same domain, keeping login cookies and API calls on one origin. No separate backend deployment or custom Node listener is needed.

PostgreSQL runs on a database provider. Use **Vercel Hobby** and **Neon Free** for the requested $0 demo. Hobby is for personal, non-commercial use. Review the current [Hobby limits](https://vercel.com/docs/plans/hobby) and [Neon plans](https://neon.com/pricing) when signing up. Do not enable paid upgrades for this demo.

## Create accounts and a database

1. Create or sign into [Vercel](https://vercel.com/signup), selecting Hobby. Complete terms and GitHub authorization yourself, granting access to `derek2706/devflow-ai`.
2. Create a [Neon](https://console.neon.tech/) account and a **Free** PostgreSQL project. Select Singapore if offered, matching Vercel's configured `sin1` region. Otherwise update `regions` in `apps/web/vercel.json` to a region near the database.
3. In Neon's connection dialog, copy the **pooled connection string** for runtime and the **direct connection string** for migrations. Keep TLS enabled. These become `DATABASE_URL` and `DIRECT_URL`.
4. Add `connection_limit=1` to the pooled URL's query parameters as a conservative starting point for the demo. Preserve supplied SSL parameters; append `&connection_limit=1` when the URL already has a query string.
5. Keep the URLs private. Enter them in Vercel's environment settings; never commit them.

Neon's Vercel Marketplace integration is also possible. Verify its plan is Free and map its pooled/direct variables to the exact names below. This app uses Prisma with PostgreSQL and does not require a paid database proxy.

## Import and configure the project

Import [the repository](https://github.com/derek2706/devflow-ai/tree/codex/deploy-vercel) in [Vercel New Project](https://vercel.com/new), using the prepared `codex/deploy-vercel` branch.

| Setting                                  | Value                      |
| ---------------------------------------- | -------------------------- |
| Framework                                | Next.js                    |
| Root Directory                           | `apps/web`                 |
| Include files outside the Root Directory | Enabled                    |
| Node.js                                  | 22.x                       |
| Install and Build commands               | Use `apps/web/vercel.json` |
| Output directory                         | Next.js default            |
| Production branch                        | `codex/deploy-vercel`      |

If the initial import selects `main`, change **Settings → Environments → Production → Branch Tracking** to `codex/deploy-vercel`, then create a new production deployment from that branch. Do not promote a preview built without Production variables: the production build must run with them to apply migrations.

The monorepo setting matters because Next imports `apps/server/dist` and uses dependencies from the root lockfile. Do not create a second project for `apps/server`.

## Production environment variables

Set these for **Production** before deploying:

| Variable              | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`        | Neon pooled PostgreSQL URL, with TLS and a small connection limit |
| `DIRECT_URL`          | Neon direct PostgreSQL URL, used by the migration build step      |
| `JWT_ACCESS_SECRET`   | New random secret, at least 32 characters                         |
| `JWT_REFRESH_SECRET`  | Different random secret, at least 32 characters                   |
| `NEXT_PUBLIC_API_URL` | `/api`                                                            |
| `AI_MODE`             | `local`                                                           |
| `TRUST_VERCEL_PROXY`  | `true`                                                            |

Generate each JWT secret separately in your terminal:

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex') + '\n')"
```

Vercel supplies `NODE_ENV=production`, `VERCEL=1`, `VERCEL_ENV`, and domain variables. Keep system environment variables exposed to the build and runtime. The API derives its primary HTTPS origin from this trusted configuration. For your own domain, explicitly set `WEB_URL` to that exact HTTPS origin. Open the canonical production URL for login; a different deployment alias is a different origin.

Only `NEXT_PUBLIC_API_URL` belongs in the browser. Never prefix database URLs, JWT secrets, email credentials, or AI keys with `NEXT_PUBLIC_`.

## Build and verification

The build generates Prisma, compiles Express, applies committed migrations **only in a Vercel Production build** using `DIRECT_URL`, then builds Next.js with its API function. Migrations use `prisma migrate deploy` and never reset the database. They run during build, not during API requests. Migration failure stops deployment. A later build failure can leave migrations applied, so schema changes must remain compatible with the previous app release.

Once Vercel reports Ready, open its assigned HTTPS URL and check:

- `/api/health` returns HTTP 200.
- `/api/health/ready` returns HTTP 200, confirming database access.
- Sign up, create a workspace/project/task, move the task, and reload.
- Log out/in and confirm the saved board remains.
- API requests use the page's hostname.

The hosted database starts empty apart from its schema. No local accounts, `.env` files, email previews, or development database contents are uploaded.

## Preview deployments

Keep production database URLs and secrets scoped to Production. For previews, use a separate Neon branch/database and separate JWT secrets with Preview-scoped variables. The preview origin comes from Vercel's trusted deployment URL unless explicitly overridden with `WEB_URL`. Test with that immutable deployment URL; a branch alias needs its own exact `CORS_ORIGINS` entry.

Migrations are skipped for previews. Initialize that isolated database with `pnpm db:migrate`, securely setting `DATABASE_URL` to its direct URL for the command. Never point a preview at production data. A preview without database/secrets configuration is not a working app.

## What changed

- A Next Pages API route delegates native HTTP requests to the existing Express backend, preserving paths, status codes, raw request bodies, and multiple cookies.
- Next's body parser is disabled for this route, retaining Express's body parsing and request-size limits.
- Prisma is reused within warm runtimes; use pooled database connections for serverless traffic.
- `/api/health/ready` checks the database with a deadline and safe error response.
- Trusted Vercel client-IP handling requires an explicit opt-in and validated header.
- `scripts/vercel-migrate.mjs` applies production migrations using the direct URL and skips previews.
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

Vercel's Git integration normally deploys updates to the production branch automatically. Use isolated previews before releasing changes. A Vercel rollback changes application code, not database migrations; only roll back to compatible code. Never run `prisma migrate reset` against the hosted database.

- **Missing backend/Prisma module:** verify the root build command and inclusion of files outside `apps/web`.
- **Migration failed:** check `DIRECT_URL`, TLS, database availability, and migration history. Build logs avoid raw database connection errors.
- **Readiness 503:** check database variables and provider availability.
- **Login 403 or loops:** use the canonical HTTPS domain, `/api`, and the correct environment's `WEB_URL`.
- **Preview has no tables:** initialize its isolated database.
- **Missing recovery email:** configure the provider and verified sender.

References: [Next API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes), [Vercel monorepos](https://vercel.com/docs/monorepos), [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables), [Prisma serverless connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections).
