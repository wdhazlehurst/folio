# OVERVIEW.md — Folio Project State

Living document: goals, roadmap, active work, and known issues. Update it as part of any change —
tick off tasks, add newly found bugs, move fixed items to Recently Resolved.

For the file-by-file map, see `INDEX.md`. For per-session agent notes, see `AGENTHISTORY.md`.

**Last updated:** 2026-08-26 · **Branch:** `feature/dashboard-integeration` · **Version:** 0.0.1

---

## 1. What we're building

A personal finance dashboard. A user signs up, records **expenses** and **assets** under their own
**categories**, and sees their spending and net worth visualized on a customizable widget dashboard.

Everything is single-user-scoped: all data is filtered by the session `userId`. There is no sharing,
no household/multi-user concept, and no external bank integration.

## 2. Goals

> These are inferred from the code and commit history. **Confirm/replace with the real product goals.**

**Product**

- Fast, low-friction expense entry (inline table editing, modal quick-add) — largely working.
- Net-worth tracking alongside spending, so a user sees both sides on one screen.
- A dashboard the user can rearrange and (eventually) choose widgets for, persisted per user.
- Light/dark theming throughout.

**Technical**

- Type-safe end to end: Prisma → Zod → React, with `Decimal` normalized at the action boundary.
- Server actions as the only data path; no hand-rolled REST layer.
- One generic, reusable query layer (`QuerySerializer` + `factory.service`) so filter/sort/paginate
  works for every model instead of being reimplemented per feature.
- Migrate charting onto **Unovis**, using Mantine only for layout/primitives.
- Deployable via Docker with migrations applied on boot.

**Explicitly not in scope right now:** bank/API imports, budgets, recurring transactions, multi-currency,
mobile app.

## 3. Current state

| Area                          | Status                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Auth (register/login/session) | Working. Credentials + JWT, role field present but only `requireRole(["*"])` is used.     |
| Expenses CRUD                 | Working (add, inline edit, list). No delete. No description field.                        |
| Expense categories            | Working (add, edit). No delete.                                                           |
| Assets / Worth page           | Working (add, inline edit, list, `isCash`). Newest feature — least exercised.             |
| Asset categories              | Working (add, edit). No delete.                                                           |
| Dashboard widgets             | Working: stats bar, category donut, spending bar chart, Unovis expense-vs-asset area chart. Layout persists in `localStorage`. |
| Charts page (`/dashboard/charts`) | Stub — renders a title only.                                                          |
| Settings page                 | UI only. Display name, password change, and delete account do nothing.                    |
| Generic query API             | Half-built and broken. `QuerySerializer` exists; `factory.service.ts` doesn't compile.    |
| Build / typecheck             | **Failing.** See § 5.                                                                     |
| Tests                         | None. No test runner installed.                                                           |
| CI                            | None.                                                                                     |

## 4. Active tasks

Ordered roughly by priority. Check off and date items as they land.

**P0 — unblock the build**

- [ ] Fix the syntax error in `src/lib/query-builder.ts` (missing closing `}` for the class) — nothing
      typechecks until this is done.
- [ ] Fix or delete `src/services/factory.service.ts`: it imports `transformToPrisma` (doesn't exist —
      the module exports the `QuerySerializer` class) and `QueryInput` from `@/types/api` (it lives in
      `src/lib/schemas.ts`). Decide whether the generic service layer stays.
- [ ] Fix the unused/broken imports in `src/app/dashboard/expenses/actions.tsx`
      (`QueryInput` from `@/types/api`, `PrismaClient`, `getModelData`).
- [ ] Reconcile `react-grid-layout` v2 types in `DashboardGrid.tsx` — v2's `GridLayoutProps` has no
      `cols`, and its `Layout` is `readonly`, so `setLayout(newLayout)` fails. Either pin to v1.x or
      port to the v2 API.
- [ ] Delete `src/app/theme.ts` (imports `@mui/material/styles`; MUI isn't installed and nothing
      imports the file).

**P1 — finish the query layer**

- [ ] Add `select` to `QueryInputSchema` in `src/lib/schemas.ts`, or stop destructuring it in
      `QuerySerializer.transform()` — currently `transform()` reads a field the schema strips.
- [ ] De-duplicate `FilterOps<T>`, defined identically in `types/api.ts` and `src/lib/schemas.ts`
      (the two copies already differ: `contains` is required in one, optional in the other).
- [ ] Make `pagination` optional in `QueryInputSchema` (callers must currently always pass it).
- [ ] Remove the "Query Serializer Test Bench" dev panel from `src/app/dashboard/expenses/page.tsx`
      once the API is trusted, and drop the `console.log`s in `expenseApi`.
- [ ] Delete the abandoned `src/lib/querys/` folder (`query.ts` empty, `types.ts` fully commented out).

**P1 — features**

- [ ] Delete operations for expenses, assets, and both category types.
- [ ] Build out `/dashboard/charts` — it's the natural home for the deeper Unovis work.
- [ ] Persist dashboard layout server-side per user instead of `localStorage` (add a model, or a JSON
      column on `User`).
- [ ] Widget add/remove, not just rearrange.
- [ ] Wire up Settings: display name persistence (needs a `name` column on `User`), password change,
      account deletion.

**P2 — polish / infrastructure**

- [ ] Migrate the remaining `@mantine/charts` widgets (donut, bar) to Unovis; then drop
      `@mantine/charts` and `recharts`.
- [ ] Add a `.env.example` documenting `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- [ ] Replace the create-next-app `README.md` with real setup docs.
- [ ] Add a test runner and cover `summary-db.ts` bucketing and `QuerySerializer.parseFilters`.
- [ ] Add CI running `lint` + `tsc --noEmit` + `build`.
- [ ] Branch name typo: `feature/dashboard-integeration` (harmless, note before merging).

## 5. Known issues & bugs

### Blocking

**B1 — `src/lib/query-builder.ts` has a syntax error.**
The `QuerySerializer` class is missing its closing brace. `npx tsc --noEmit` on a clean checkout
reports exactly one error: `query-builder.ts(71,1): error TS1005: '}' expected.` The build cannot
succeed. Fix this first.

**B2 — `src/services/factory.service.ts` imports symbols that don't exist.**
`transformToPrisma` from `@/lib/query-builder` and `QueryInput` from `@/types/api`. Both resolve to
nothing. The file is in the build graph because `expenses/actions.tsx` imports `getModelData` from it
(and then never calls it).

**B3 — `react-grid-layout` v2 API mismatch in `DashboardGrid.tsx`.**
Installed version is `^2.2.3`. Three separate type errors: `cols` is not a valid prop, and `onDragStop`
/`onResizeStop` hand back a `readonly Layout` that can't be assigned to the mutable `LayoutItem[]`
state. The code was written against the v1 API.

### Non-blocking but real

**B4 — `src/app/theme.ts` imports `@mui/material/styles`, which is not installed.** Dead file left over
from an earlier MUI phase. Nothing imports it. Delete it.

**B5 — `getCategoryById` in `expenses/categories/actions.tsx` ignores `userId`.** It takes `userId` as a
parameter but queries `findFirst({ where: { id } })` only. A user who supplies another user's category
id can attach their expense to it. The asset version (`worth/categories/actions.tsx`) does this
correctly with `where: { id, userId }`. **Fix the expense one to match.**

**B6 — `types/types.d.ts` conflicts with `types/next-auth.d.ts`.** Both augment NextAuth's `User`;
`types.d.ts` declares `id: integer`, which isn't a TypeScript type. It goes unreported only because
`skipLibCheck: true` skips declaration files. Delete `types/types.d.ts`.

**B7 — `Expense.description` exists in the Zod type and `NewExpense`, but not in the Prisma schema.**
`getUserExpenses` carries a `// FIXME need to add description/note`. Either add the column or drop it
from the types.

**B8 — Widget/data mismatches in the dashboard.**

- `dashboard/page.tsx` passes `monthlyTrend` and `monthlyData` the same value (`getMonthlyTrend(12)`),
  so the "Monthly Overview" chart's expense series and the bar chart are the same series.
- The spending bar widget is titled "6-Month Spending Trend" but is fed 12 months.

**B9 — `dashboard/DashboardLayout.tsx` is dead code.** It's a second server dashboard body superseded
by `dashboard/page.tsx`, and its name collides confusingly with `dashboard/layout.tsx`. Delete it.

**B10 — `requireRole` redirects to `/unauthorized`, which doesn't exist.** Marked `// TODO Change this`.
Unreachable today because only `requireRole(["*"])` is called.

**B11 — Landing page copy says "Welcome to FinanceApp"** while the app is branded Folio everywhere else.

**B12 — `postcss-preset-mantine` and `postcss-simple-vars` are installed but there is no
`postcss.config.mjs`.** The CSS modules only use native `light-dark()` today so nothing is broken, but
Mantine mixins (`@mixin dark`, `rem()`) will silently not work until the config is added.

**B13 — `StatsSegmentsExpenses.tsx` has a duplicated `"use client"` directive** (line 1 and line 4).
Harmless; clean it up when touching the file.

**B14 — `Dockerfile` has `RUN chmod +X` (capital X).** `+X` only sets execute on directories/
already-executable files, so `docker-entrypoint.sh` may not be executable in the image. Should be `+x`.
Also, the runtime stage copies the whole builder `/app` including dev dependencies.

**B15 — `new PrismaClient()` at module scope without a global singleton.** In Next dev with HMR this
leaks connections across reloads. Use the standard `globalThis` cached-client pattern.

**B16 — Reported dashboard crash.** Commit `dd7dc56` notes "crashed one time, don't know why exactly"
in the draggable widget system. Unreproduced, root cause unknown — likely related to B3.

### Environment note (not a code bug)

A fresh clone reports ~20 extra type errors of the form `Module '"@prisma/client"' has no exported
member 'PrismaClient' / 'Prisma'` plus cascading implicit-`any`s. These disappear after
`npx prisma generate`, which must be run before typechecking. Don't "fix" them in source.

## 6. Recently resolved

- Dashboard SSR crash from `react-grid-layout` — fixed by the `DashboardGridClient` dynamic-import
  wrapper (`61dd5ba`).
- Asset schema + Worth page shipped (`fbddaec`).
- Postgres 18 support in `docker-compose.yml` (`a40b55f`).

## 7. Open questions

- Does the generic query layer (`QuerySerializer` + `factory.service`) stay, or do per-feature actions
  remain the pattern? The half-finished state is the biggest source of dead code right now.
- Should assets be point-in-time snapshots (one row per valuation per month) or mutable current
  balances? `getMonthlyAssetTrend` sums assets *by their `date` field*, which reads as "assets acquired
  that month" rather than "net worth that month" — the Monthly Overview chart's meaning depends on this.
- Are `ADMIN`/`MODERATOR` roles actually going to be used? Nothing consumes them.
