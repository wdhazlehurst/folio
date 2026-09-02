# OVERVIEW.md — Folio Project State

Living document: goals, roadmap, active work, and known issues. Update it as part of any change —
tick off tasks, add newly found bugs, move fixed items to Recently Resolved.

For the file-by-file map, see `INDEX.md`. For per-session agent notes, see `AGENTHISTORY.md`.

**Last updated:** 2026-09-01 · **Branch:** `limit-testing` · **Version:** 0.0.1

---

## 1. What we're building

A personal finance dashboard. A user signs up, records **expenses** and **assets** under their own
**categories**, and sees their spending and net worth visualized on a customizable widget dashboard.

Everything is single-user-scoped: all data is filtered by the session `userId`. There is no sharing,
no household/multi-user concept, and no external bank integration.

## 2. Goals

> **The owner-confirmed product vision now lives in `CURRENT.md` § Long term goals** (Income, budget
> allocation, Debts, Investments, Projections). That is the authoritative statement of direction —
> this section keeps only the technical goals.

**Technical**

- Type-safe end to end: Prisma → Zod → React, with `Decimal` normalized at the action boundary.
- Server actions as the only data path; no hand-rolled REST layer.
- One generic, reusable query layer (`QuerySerializer` + `factory.service`) so filter/sort/paginate
  works for every model instead of being reimplemented per feature.
- Migrate charting onto **Unovis**, using Mantine only for layout/primitives.
- Deployable via Docker with migrations applied on boot.

**Explicitly not in scope right now:** bank/API imports, multi-currency, mobile app.
(Budgets and recurring transactions were previously listed here; as of 2026-08-31 they are **core** to
the product vision — see `CURRENT.md`.)

## 3. Current state

| Area                          | Status                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Auth (register/login/session) | Working. Credentials + JWT, role field present but only `requireRole(["*"])` is used.     |
| Expenses CRUD                 | Working (add, inline edit, list, description). No delete.                                 |
| Expense categories            | Working (add, edit). No delete.                                                           |
| Assets / Worth page           | Working (add, inline edit, list, `isCash`). Newest feature — least exercised.             |
| Asset categories              | Working (add, edit). No delete.                                                           |
| Dashboard widgets             | Working: stats bar, category donut, spending bar chart, Unovis expense-vs-asset area chart. Layout persists in `localStorage`. |
| Earnings (`/dashboard/earnings`) | **New (Phase 1).** Recurring rules, auto-posted occurrences with confirm/cancel, skip+override on projected slots, trailing income averages. |
| Budget (`/dashboard/budget`)  | **New (Phase 1).** Envelope buckets w/ per-bucket rollover, monthly periods, allocation from confirmed income, green/yellow/red health. |
| Charts page (`/dashboard/charts`) | Stub — renders a title only.                                                          |
| Settings page                 | UI only. Display name, password change, and delete account do nothing.                    |
| Generic query API             | **Working.** `QuerySerializer` + per-model field allowlists; `factory.service.ts` rebuilt but not yet called. |
| Build / typecheck             | **Passing.** `tsc --noEmit` 0 errors, `npm run build` succeeds (Phase 0, 2026-09-01).      |
| Tests                         | None. No test runner installed.                                                           |
| CI                            | None.                                                                                     |

## 4. Active tasks

Ordered roughly by priority. Check off and date items as they land.

**P0 — unblock the build** ✅ **done 2026-09-01 (Phase 0)**

- [x] Fix the syntax error in `src/lib/query-builder.ts` (B1).
- [x] Fix `src/services/factory.service.ts` — rebuilt against the `QuerySerializer` class (B2).
- [x] Fix the unused/broken imports in `src/app/dashboard/expenses/actions.tsx`.
- [x] Reconcile `react-grid-layout` v2 in `DashboardGrid.tsx` — swapped to the `react-grid-layout/legacy`
      v1-compatibility entry point (B3).
- [x] Delete `src/app/theme.ts` (B4).

**P1 — finish the query layer**

- [x] Resolve `select` — dropped from `transform()`; call sites supply their own.
- [x] De-duplicate `FilterOps<T>` — `types/api.ts` is now the single definition.
- [x] Make `pagination` optional.
- [x] Drop the `console.log`s in `expenseApi`.
- [ ] Remove the "Query Serializer Test Bench" dev panel from `src/app/dashboard/expenses/page.tsx`
      once the API is trusted. It now has two buttons (valid query + blocked-field check).
- [ ] Delete the abandoned `src/lib/querys/` folder (`query.ts` empty, `types.ts` fully commented out).
      Still present.
- [x] Fix B17 (falsy `eq` values dropped) — done in Phase 1; `!== undefined` now applied to `contains`, `eq`, and `in`.
- [ ] `getModelData<T>` takes `QuerySerializer<any, any>`, so its `T` is unconnected to the serializer's
      and `data as T[]` is an unchecked assertion. Tighten when it gets its first caller.

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
- [ ] Delete the stale `feature/phase0-groundwork` branch — it points at `6996c01` and has none of the
      Phase 0 work on it; that landed as `d52de80` instead.
- [ ] `README.md` § "Coding with Agents" holds a bootstrap prompt that still claims the repo doesn't
      typecheck or build, and points at B1-B3. Refresh or remove it.

## 5. Known issues & bugs

Every blocking issue is resolved — the repo typechecks and builds. See § 6.

### Security

**B5 — `getCategoryById` in `expenses/categories/actions.tsx` ignores `userId`.** It takes `userId` as a
parameter but queries `findFirst({ where: { id } })` only. A user who supplies another user's category
id can attach their expense to it. The asset version (`worth/categories/actions.tsx`) does this
correctly with `where: { id, userId }`. **Fix the expense one to match.** Still open as of 2026-09-01.

### Non-blocking but real

**B6 — `types/types.d.ts` conflicts with `types/next-auth.d.ts`.** Both augment NextAuth's `User`;
`types.d.ts` declares `id: integer`, which isn't a TypeScript type. It goes unreported only because
`skipLibCheck: true` skips declaration files. Delete `types/types.d.ts`.

**B9 — `dashboard/DashboardLayout.tsx` is dead code.** It's a second server dashboard body superseded
by `dashboard/page.tsx`, and its name collides confusingly with `dashboard/layout.tsx`. Delete it.

**B10 — `requireRole` redirects to `/unauthorized`, which doesn't exist.** Marked `// TODO Change this`.
Unreachable today because only `requireRole(["*"])` is called.

**B11 — Landing page copy says "Welcome to FinanceApp"** while the app is branded Folio everywhere else.

**B12 — `postcss-preset-mantine` and `postcss-simple-vars` are installed but there is no
`postcss.config.mjs`.** The CSS modules only use native `light-dark()` today so nothing is broken, but
Mantine mixins (`@mixin dark`, `rem()`) will silently not work until the config is added.

**B14 — `Dockerfile` has `RUN chmod +X` (capital X).** `+X` only sets execute on directories/
already-executable files, so `docker-entrypoint.sh` may not be executable in the image. Should be `+x`.
Also, the runtime stage copies the whole builder `/app` including dev dependencies.

**B15 — `new PrismaClient()` at module scope without a global singleton.** In Next dev with HMR this
leaks connections across reloads. Use the standard `globalThis` cached-client pattern.

**B16 — Reported dashboard crash.** Commit `dd7dc56` notes "crashed one time, don't know why exactly"
in the draggable widget system. Unreproduced, root cause unknown.

**B17 — RESOLVED, see § 6.** `parseFilters` silently drops falsy `eq` values. `src/lib/query-builder.ts:96` tests
`else if (fieldOps.eq)`, so `eq: false` and `eq: 0` fail the truthiness check and no filter is applied —
the query returns **every** row instead of the matching subset, with no error. Newly reachable because
Phase 0 added `boolean` to `FilterOpsSchema.eq` and `isCash` to `ASSET_QUERY_FIELDS`, so
Fixed in Phase 1.

**B19 — off-by-one date in the expense and asset edit pickers.** `DatePickerInput` in
`ExpenseTable.tsx` and `AssetTable.tsx` receives a `@db.Date` value as a UTC-midnight `Date` and renders
it with local-time accessors, so **editing a row shows the previous day** for anyone west of UTC. The
read-only text column is correct because it formats via `toISOString()`. Fix by routing both through
`src/lib/dates.ts` and `formatDay`, which the Phase 1 pages already do. Found during the Phase 1 review.

### Environment note (not a code bug)

A fresh clone reports ~20 extra type errors of the form `Module '"@prisma/client"' has no exported
member 'PrismaClient' / 'Prisma'` plus cascading implicit-`any`s. These disappear after
`npx prisma generate`, which must be run before typechecking. Don't "fix" them in source.

## 6. Recently resolved

**Phase 0 — groundwork (2026-09-01, branch `feature/phase0-groundwork`, uncommitted at time of writing)**

- **B1** — closing brace restored in `src/lib/query-builder.ts`; that single parse error had been masking
  every other error in the repo.
- **B2** — `factory.service.ts` rebuilt against the `QuerySerializer` class (it had imported a
  `transformToPrisma` function that never existed). The `fixedWhere` parameter was dropped, so there is
  no longer a second way to get tenancy wrong.
- **B3** — `DashboardGrid.tsx` now imports from `react-grid-layout/legacy`, the v1-compatibility entry
  point v2.2.3 ships. Copy-on-write for the readonly `Layout`, `GRID_MARGIN` hoisted as a readonly
  tuple, and the stale `@types/react-grid-layout` removed from devDependencies.
- **B4** — `src/app/theme.ts` deleted.
- **B7** — `Expense.description` column added (`VARCHAR(256)`) and wired through the actions and form.
- **Money type migrated** from Postgres `MONEY` to `Decimal(12,2)` on `Expense.amount` and `Asset.amount`.
  **The database was not empty** — it held 1 user, 2 expenses, 2 assets — so this was applied via
  `migrate diff` + `migrate deploy` after a backup to `/tmp/folio_dev_pre_phase0.sql`. All values
  verified exact after the cast; `migrate status` reports no drift.
- **Query layer hardened** beyond the plan: per-model field allowlists in `src/lib/query-fields.ts`
  typed as `Extract<keyof T, string>`, and a `.strict()` `FilterOpsSchema` so unknown *operators* are
  rejected rather than silently ignored.
- **`ExpenseSchema.categoryId` is now `.nullable()`** — Prisma's column is `String?` and
  `getUserExpenses` has always returned `null` for uncategorised rows. A real pre-existing error that
  B1 was hiding.

**Phase 1 — Earnings + budget allocation (2026-09-01, branch `limit-testing`, uncommitted)**

- Six models and four enums in one additive migration, plus `Expense.bucketId`. No drift.
- New pure modules: `src/lib/recurrence.ts` (occurrence expansion, no Prisma — one implementation
  shared by projection, materialisation, and the future catch-up checker), `dates.ts` (UTC-safe date
  maths), `format.ts`.
- Routes `/dashboard/earnings` and `/dashboard/budget`, both in the navbar.
- **B17** — `parseFilters` no longer drops falsy filter values; `!== undefined` applied to `contains`,
  `eq`, and `in`, with a comment naming the bug.
- **B18** — `getIncomeAverages` measured coverage from the earliest *confirmed* earning, so the divisor
  tracked how far back the user had clicked Confirm rather than how much income history existed.
  Confirming a recent paycheck inflated the monthly rate (observed ~3x reality) and only confirming the
  oldest row corrected it. Coverage now derives from the earliest earning of **any** status; the
  numerator stays `CONFIRMED`-only, so the figure rises monotonically to the true rate. The divisor is
  also floored at one average month (`DAYS_PER_MONTH`), so a one-day history reads as what was actually
  received instead of an absurd annualised figure. **Found by the owner while using the feature.**

**Frontend cleanup (owner, `5407691` / `6996c01`)**

- **B8** — `dashboard/page.tsx` now passes distinct `getMonthlyTrend(6)` and `getMonthlyTrend(12)`, and
  the bar widget title is derived (`${monthlyTrend.length}-Month Spending Trend`) instead of hardcoded.
- **B13** — the duplicated `"use client"` in `StatsSegmentsExpenses.tsx` is gone.

**Earlier**

- Dashboard SSR crash from `react-grid-layout` — fixed by the `DashboardGridClient` dynamic-import
  wrapper (`61dd5ba`).
- Asset schema + Worth page shipped (`fbddaec`).
- Postgres 18 support in `docker-compose.yml` (`a40b55f`).

## 7. Open questions

- Are `ADMIN`/`MODERATOR` roles actually going to be used? Nothing consumes them.

> Two long-standing questions here were settled on 2026-08-31 and now live in `CURRENT.md` § Design
> decisions: the generic query layer **stays** (fixed and adopted in Phase 0), and account balances are
> **current balance + snapshot history**, which supersedes the old `getMonthlyAssetTrend` ambiguity.
