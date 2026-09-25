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

```text
src/
  app/                    Next.js entry pages, metadata, theme/reset
  components/
    devflow.tsx           Small authentication gate
    layout/               Persistent app shell, sidebar, header, startup state
    ui/                   Reusable visual primitives and accessible modal
    styles/               Shared CSS primitives used through composes
  contexts/               Session-expiry notification
  hooks/                  Shared resource loading and cancellation
  features/
    auth/                 Login/signup/recovery UI and session/form hooks
    dashboard/            Overview, stats, project list, tasks, activity
    workspaces/           Workspace pages, editors, members, invitations
    invitations/          Accept an invitation
    projects/             Project page, shared project card/editor, Kanban
    tasks/                Task editor, fields, comments, AI entry point
    ai/                   Draft state, settings, results, actions, provenance
  lib/                    HTTP client, API types, class/date helpers
  pages/api/              Bridge to the Express API
```

The feature page coordinates fetching, permissions displayed in the UI, mutations, and dialogs. Its child components receive typed data and callbacks. For example, `project-view.tsx` owns project state and writes, `project-board.tsx` renders filters and columns, `board-column.tsx` handles drop targets, and `task-card.tsx` renders a task. Board filters remain in the page so they survive a temporary loading/error state.

Shared components have their own modules: `Modal`, `Icon`, `Avatar`, `Logo`, `PriorityBadge`, feedback banners, loading placeholders, and empty states. Import the specific file you need; there is no catch-all UI export. `ProjectCard` and `ProjectEditor` belong to the projects feature and are reused by dashboard/workspace screens.

`useResource` owns request cancellation, stale-result protection, refresh state, and session-expiry handling. `useSession` owns the signed-in user lifecycle. The authenticated shell remains mounted across navigation, so changing screens does not repeat startup or discard the selected workspace. `useAiDraft` owns generation, proposal edits, copying, and partial-save retries; the result components only render the draft.

## Where to make changes

| Change                           | Start here                                                                 |
| -------------------------------- | -------------------------------------------------------------------------- |
| Sidebar/workspace switcher       | `src/components/layout/app-sidebar.tsx`                                    |
| Login fields or submit behavior  | `src/features/auth/auth-form.tsx`, `use-auth-form.ts`                      |
| Project board or drag/drop       | `src/features/projects/project-board.tsx`, `board-column.tsx`              |
| Task fields, saving, or comments | `src/features/tasks/task-form.tsx`, `task-editor.tsx`, `task-comments.tsx` |
| Workspace member management      | `src/features/workspaces/workspace-members.tsx`                            |
| AI preview appearance            | `src/features/ai/ai-results.tsx`                                           |
| AI request/apply behavior        | `src/features/ai/use-ai-draft.ts`                                          |
| HTTP calls/token refresh         | `src/lib/api.ts`                                                           |
| API response types               | `src/lib/types.ts`                                                         |

Keep a component in its feature until another feature needs it. Extract a shared UI primitive when it has reusable behavior or presentation, rather than adding page-specific switches to a generic component. A display component should not silently fetch data already available from its parent. Pass callbacks for mutations, and refresh only the resources affected by a successful change. Server authorization remains authoritative; UI role checks only control presentation.

## Verify a frontend change

```sh
pnpm --filter web lint
pnpm --filter web test
pnpm build:production
```

The automated web tests cover the API bridge, token-refresh races, task form values, board filter combinations and permission-dependent controls, and AI provider/fallback labels. They do not replace browser checks. Verify login, dashboard/workspace/project navigation, task editing and comments, keyboard/modal focus, board filtering and status movement, and AI draft generation/application for the feature you changed. Use a disposable local account for writes. Closing an unchanged task should not fetch the board again; generating an AI proposal should not create tasks until Add is selected.

## Styling safely

Each feature owns its `*.module.css` files. Related presentation components within a feature share its module; common UI primitives use `components/ui/ui.module.css`. Import that module and use `styles["class-name"]`; class names are scoped to that file. Keep responsive rules and state variants in the owning component's module.

`src/components/styles/shared.module.css` contains deliberately shared primitives: buttons, native controls, typography, form layouts, panels, and reusable badges. Feature modules opt into these with CSS Modules `composes`. Editing a shared primitive intentionally affects its consumers; add a local feature rule when a change should affect only one screen. `src/lib/class-names.ts` joins conditional module classes.

Reusable components such as `Avatar`, `Logo`, and `ProjectCard` accept `className` for explicit local overrides. Pass the feature module's class instead of targeting another component's internal class name. Dynamic project colors and progress percentages remain inline because they come from application data.

`src/app/globals.css` is limited to theme variables, document defaults/reset, and the user's reduced-motion preference. Component classes, controls, typography rules, and responsive layouts belong in modules. Avoid adding global class selectors or `:global()` escapes.

All displayed project data comes from the API. Sessions use HttpOnly cookies rather than browser storage. Kanban tasks can be moved by dragging or by selecting Status in the task dialog. AI proposals only become tasks after the user explicitly adds them.
