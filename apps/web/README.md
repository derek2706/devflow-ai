# DevFlow AI web app

See the [project README](../../README.md) for full setup, features, database, environment variables, permissions, and development email instructions.

From the repository root, use Node 22 and run:

```sh
pnpm install
pnpm dev:web
pnpm --filter web lint
pnpm --filter web build
```

The frontend runs at http://localhost:3000 and calls `/api` on the same origin. During development, Next proxies these requests to the API at http://127.0.0.1:5001. Copy `.env.example` to `.env.local` only if you need to change these defaults.

For hosting, `pnpm build:production` at the repository root generates Prisma and builds Express before Next.js. The Pages API route at `src/pages/api/[[...path]].ts` delegates native HTTP requests to the compiled Express app. The frontend and API are deployed together as one Next.js project; no custom server is required. See the [Vercel deployment guide](../../docs/DEPLOYMENT.md) for account setup, database configuration, migrations, and verification.

## Structure

- `src/app`: Next.js entry pages, metadata, document reset, and theme variables.
- `src/components/devflow.tsx`: authenticated shell, navigation, workspace switcher, and invitation acceptance.
- `src/components/auth.tsx`: sign up, login, forgotten password, and reset password.
- `src/components/dashboard.tsx`: live project stats, recent tasks/activity, and project cards.
- `src/components/workspace.tsx`: workspace projects, members, invitations, and settings.
- `src/components/project.tsx`: Kanban boards, drag and drop, column settings, and project members.
- `src/components/task.tsx`: task editing, accessible status selection, and comments.
- `src/components/ai.tsx`: local/provider mode disclosure, generated previews, and explicit task creation.
- `src/components/ui.tsx`: accessible dialogs, loading/error states, icons, and data loading.
- `src/lib/api.ts`: credentialed API calls and shared automatic session refresh.
- `src/lib/types.ts`: API response types.

## Styling safely

Each component has a matching `*.module.css` file beside it. Import that module and use `styles["class-name"]`; class names are scoped to that file. Keep responsive rules and state variants in the owning component's module.

`src/components/shared.module.css` contains deliberately shared primitives: buttons, native controls, typography, form layouts, panels, and reusable badges. Feature modules opt into these with CSS Modules `composes`. Editing a shared primitive intentionally affects its consumers; add a local feature rule when a change should affect only one screen. `src/lib/class-names.ts` joins conditional module classes.

Reusable components such as `Avatar`, `Logo`, and `ProjectCard` accept `className` for explicit local overrides. Pass the feature module's class instead of targeting another component's internal class name. Dynamic project colors and progress percentages remain inline because they come from application data.

`src/app/globals.css` is limited to theme variables, document defaults/reset, and the user's reduced-motion preference. Component classes, controls, typography rules, and responsive layouts belong in modules. Avoid adding global class selectors or `:global()` escapes.

All displayed project data comes from the API. Sessions use HttpOnly cookies rather than browser storage. Kanban tasks can be moved by dragging or by selecting Status in the task dialog. AI proposals only become tasks after the user explicitly adds them.
