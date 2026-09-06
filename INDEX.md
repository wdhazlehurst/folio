# INDEX.md — Folio Repository Map

**Read this file first.** It is the entry point for any AI agent working in this repo. It replaces
searching the tree file-by-file.

## Rules for agents

Follow these on every task in this repo. They are binding, not advisory — when a rule and your own
judgement disagree, follow the rule or stop and ask.

1. **Never make assumptions — ask before assuming.** This goes both ways: if the user appears to be
   assuming something, ask them to clarify rather than going along with it.
2. **When fully finished with a task or issue, update the relevant `.md` files** to reflect that it's
   done.
3. **Before making a large change, think about how it may affect other systems.** If anything comes up,
   ask first.
4. **Don't update the docs as you go.** The user prompts for a doc update at the end of a work session;
   that is when `CURRENT.md`, `OVERVIEW.md`, and `AGENTHISTORY.md` normally get written. Constant
   context updates burn tokens for little benefit — don't do them.
5. **Two exceptions, where you should write it down immediately without being asked:**
   - **A significant bug found off-task.** Something real surfaces that isn't related to the current
     work and the user doesn't want to chase it now — record it so it isn't lost. Small papercuts go in
     `CURRENT.md` § Known minor bugs; blocking or security issues go in `OVERVIEW.md` § 5.
   - **Hard-won context.** If several prompts were spent digging out a fact that wasn't easy to find,
     and it was finally pinned down, record it right away — in `AGENTHISTORY.md` if it's a trap or dead
     end, in `INDEX.md` if it's a durable fact about the codebase. Only when it genuinely took real
     effort; a fact learned by opening one file does not qualify.

   If you think something clears this bar but you're unsure, ask rather than writing unprompted.
6. **Never touch `CURRENT.md` § Current task unless explicitly told to.** That section defines what the
   user is working on — it's theirs to set, not yours to infer. If you think something belongs there
   (the task has shifted, or work you did warrants adding to it), **ask**; don't write it. This holds
   even under rule 5: those exceptions cover the bug lists and `AGENTHISTORY.md`, never Current task.
7. **Ask before anything that deletes or modifies existing data.** `deleteMany` / `updateMany`,
   `prisma migrate reset`, dropping or retyping a populated column, and — the one that has already bitten
   us — **cleanup steps in verification scripts**. This repo is often driven in bypass-permissions mode,
   so nothing external will stop you; the check has to be yours. When you do get the go-ahead: back up
   first (`pg_dump`), scope deletes to ids your own script created rather than to `userId`, and assert
   that pre-existing rows survived before you report success. The dev database holds hand-entered data
   that cannot be regenerated.
8. **Scratch databases are encouraged — but drop them when you're done.** Verifying against a separate
   database (e.g. `folio_phase2_test`) instead of `folio_dev` is the right way to exercise real logic
   without risking real data, and Phase 2 was verified exactly that way. Creating one needs no
   permission. Leaving one behind does: finish by dropping it
   (`docker exec folio-db-1 psql -U postgres -c 'DROP DATABASE <name>;'`) and say in your report that
   you did. Same for dev servers you start — shut them down rather than leaving ports held.

## The four docs

| File               | Purpose                                                                                      | Who writes it                                                            |
| ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `INDEX.md`         | Static map of the codebase: what every file is, conventions, commands, data model.             | Update when files are added/moved/deleted or a convention changes.        |
| `CURRENT.md`       | The task at hand right now, long term goals, known minor bugs, then an Old tasks archive.       | Update when the task changes, or when a small bug is found or squashed.   |
| `OVERVIEW.md`      | Full project state: goals, roadmap, status by area, and all known issues incl. blocking ones.   | Update when you fix a bug, finish a task, or discover a new one.          |
| `AGENTHISTORY.md`  | Append-only log. Each agent records what it did, what it learned, and traps it hit.             | Append a dated entry only for significant sessions. Never rewrite history.|

`CURRENT.md` vs `OVERVIEW.md`: `CURRENT.md` is the narrow "what am I doing today" view plus small
papercuts. `OVERVIEW.md` is the full picture — every feature area's status, the prioritized task list,
and blocking/security issues. Minor bugs live in `CURRENT.md`; blockers live in `OVERVIEW.md`. Issue IDs
(B1, B2, …) are shared between them, so don't renumber.

Workflow for a new agent: read `INDEX.md` → read `CURRENT.md` (what's active) → read `OVERVIEW.md`
(full state/bugs) → skim the last few entries of `AGENTHISTORY.md` → work → update the relevant docs
per the rules above.

**Read only the leading sections of each doc unless something deeper is relevant to your task.** In
`CURRENT.md` that means Current task, Long term goals, and Known minor bugs — its trailing **Old tasks**
archive is for reference only, so skip it unless it bears on what you were asked to do. Likewise, skim
only the most recent `AGENTHISTORY.md` entries rather than the whole log. This is deliberate: these docs
grow, and reading all of them end-to-end every session wastes tokens.

---

## What this project is

**Folio** — a personal finance dashboard web app. Users register, log expenses and assets under
user-owned categories, and view aggregated spending/net-worth charts on a draggable widget dashboard.

Single Next.js app (App Router), server actions for all data access (no REST layer beyond NextAuth),
Postgres via Prisma, Mantine as the UI system.

## Stack (from `package.json`, exact versions there)

- **Next.js 15** (App Router, `--turbopack` in dev), **React 19**, **TypeScript 5** (`strict: true`)
- **Prisma 6** + `@prisma/client` → **PostgreSQL 18** (via Docker Compose)
- **NextAuth v5 beta** (`next-auth@5.0.0-beta.28`), Credentials provider, JWT sessions, `bcrypt`
- **Mantine 8** (`@mantine/core`, `/charts`, `/dates`, `/form`, `/hooks`) — primary UI + chart lib today
- **@unovis/react + @unovis/ts 1.6** — newer chart lib, being adopted (currently only `ExpenseIncomeChart`)
- **react-grid-layout 2.x** — draggable/resizable dashboard widgets
- **zod 4** — schemas for auth, query input, and domain types
- **framer-motion** — page transitions in the dashboard shell
- `recharts` is a transitive/unused direct dep — Mantine charts wraps it; do not import it directly
- `@tabler/icons-react`, `dayjs`, `validator`

## Commands

```bash
docker compose up -d          # Postgres 18 on :5432 (db folio_dev, postgres/postgres)
npx prisma generate           # REQUIRED after clone — client is not committed
npx prisma migrate dev        # apply/author migrations
npm run dev                   # Next dev server on :3000 (turbopack)
npm run build                 # production build
npm run lint                  # eslint (next/core-web-vitals + next/typescript)
npm run prettier              # format (printWidth 120, semi, double quotes, es5 trailing comma)
npx tsc --noEmit              # typecheck — currently passes (0 errors)
```

Env vars (no `.env` is committed — `.gitignore` excludes `.env*`):
`DATABASE_URL` (Postgres), `NEXTAUTH_SECRET` (required; entrypoint hard-fails without it),
`NEXTAUTH_URL`.

## Path aliases (`tsconfig.json`)

| Alias             | Resolves to     | Note                                            |
| ----------------- | --------------- | ----------------------------------------------- |
| `@/*`             | `./src/*`       | e.g. `@/lib/prisma`, `@/constants`              |
| `@/components/*`  | `./components/*`| root-level, **not** under `src/`                |
| `@/css/*`         | `./css/*`       | root-level shared CSS modules                   |
| `@/types/*`       | `./types/*`     | root-level, **not** under `src/`                |
| `@/auth`          | `./src/lib/auth.ts` | direct file alias                            |

`components/`, `css/`, and `types/` live at the repo root, outside `src/`. Widget-local CSS modules
live next to their component instead.

---

## File map

### Root config

| Path                   | What it is                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| `package.json`         | Deps + scripts. `version` is read by `DashboardNavbar` to display `v0.0.1`.  |
| `tsconfig.json`        | `strict: true`, `skipLibCheck: true` (so `.d.ts` files are NOT typechecked). |
| `next.config.ts`       | Empty config object.                                                        |
| `eslint.config.mjs`    | Flat config, extends `next/core-web-vitals` + `next/typescript`.            |
| `docker-compose.yml`   | Postgres 18 service `db` only. The app is not containerized in compose.     |
| `Dockerfile`           | 2-stage node:24 build → node:24-slim runtime. Runs `prisma generate` + build.|
| `docker-entrypoint.sh` | Requires `NEXTAUTH_SECRET`, runs `prisma migrate deploy`, then the CMD.      |
| `README.md`            | Mostly stock create-next-app text + docker compose usage.                    |

### `prisma/`

- `schema.prisma` — datasource `postgresql`, generator `prisma-client-js`. Models below.
- `migrations/` — 9 migrations, latest `20260902232410_phase2_debts`.

**Data model** (all IDs are `uuid` strings; money is `@db.Decimal(12, 2)` → Prisma `Decimal`; `date` is `@db.Date`):

```
User            id, email(unique), password(bcrypt), role(Role enum: USER|ADMIN|MODERATOR)
                → expenses[], expenseCategories[], assets[], assetCategories[]

ExpenseCategory id, title(≤32), description?(≤128), userId, createdAt, updatedAt
                @@unique([title, userId])  @@index([userId])
Expense         id, title(≤32), description?(≤256), amount(Decimal 12,2), userId, categoryId?,
                bucketId? (charge against a budget bucket), date, ...

AssetCategory   id, title(≤32), description?(≤128), userId, createdAt, updatedAt
                @@unique([title, userId])  @@index([userId])
Asset           id, title(≤32), amount(Decimal 12,2), isCash(bool), userId, categoryId?, date, ...
```

**Phase 1 — earnings + budget** (enums: `PostingStatus` PROJECTED|CONFIRMED|CANCELLED ·
`EarningFrequency` WEEKLY|BIWEEKLY|SEMI_MONTHLY|MONTHLY · `OccurrenceExceptionAction` SKIP|OVERRIDE ·
`BucketAllocationType` PERCENT|FIXED):

```
EarningRule       recurring income definition: grossAmount, netAmount, frequency, anchorDate
                  (= the date money HITS THE ACCOUNT), secondDayOfMonth?, endDate?, isActive,
                  lastMaterializedThrough (catch-up watermark for the future launch-time checker)
Earning           a materialised occurrence, or a one-off when ruleId is null. status(PostingStatus),
                  date (actual), scheduledDate (the rule slot it fills — kept separate so an override
                  cannot make the projector re-emit), confirmedAt
                  @@unique([ruleId, scheduledDate])  ← idempotent auto-posting; NULLs are distinct in
                  Postgres, so unlimited one-offs never collide
                  rule relation is onDelete: SetNull — deleting a rule must not destroy posted income
EarningException  skips or overrides ONE future slot of a rule (date/gross/net). Phase 2's debt
                  payment override is meant to be structurally identical.

BudgetBucket      envelope: allocationType, allocationValue, rollover(bool, opt-in per bucket),
                  sortOrder, isActive
BucketPeriod      one month of one bucket; openingBalance is the rollover carry-in and the ONLY
                  stored figure — allocated and spent are derived. closedAt makes closing idempotent.
BucketAllocation  money moved from one CONFIRMED Earning into one bucket.
                  The earningId FK is what structurally enforces "buckets fund from actual income,
                  never projections" — a projected occurrence has no row, so it has no id to cite.
```

**Phase 2 — debts** (no new enums; `PostingStatus`, `EarningFrequency` and
`OccurrenceExceptionAction` are reused deliberately, so debts and earnings share one posting flow):

```
Debt                  balance, interestRate Decimal(6,4), minimumPayment, paymentAmount (what will
                      ACTUALLY be paid, may exceed the minimum), anchorDate, endDate?, isActive,
                      lastMaterializedThrough watermark, bucketId?, categoryId?
DebtPayment           mirrors Earning: amount, date, scheduledDate?, status, confirmedAt,
                      expenseId? @unique  ← the generated Expense
                      @@unique([debtId, scheduledDate])  ← idempotent posting, same trick as Earning
DebtPaymentException  structurally identical to EarningException (SKIP / OVERRIDE)
```

Posting a debt payment is transactional: it creates an `Expense` stamped with the debt's `bucketId`
and `categoryId`, links it via `expenseId`, and decrements `Debt.balance`. Because bucket spend is
derived by summing expenses, debt payments land in the bucket with no second counter to drift. The
amount is capped at the remaining balance, so the final payment pays the debt to exactly zero.

**Behaviour worth knowing:** a scheduled slot passed over because the balance was exhausted is *not*
permanently skipped — if the balance later rises (a cancellation, or a manual correction), that
payment posts. Deliberate: losing it silently would be worse. The materialiser's lookback bounds how
far back this can reach.

Assets and Expenses are structurally near-identical; `Asset` adds `isCash`. Expense has **no**
`description` column despite the type allowing one (see `OVERVIEW.md`).

### `types/` (root-level, `@/types/*`)

| File              | Contents                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `api.ts`          | `ActionResult` = `{ok:true} \| {ok:false,error}` — the standard server-action return. Also the **single** home for query types: `FilterOps<T>`, `QueryInput<T>`, `SortDirection`, `Pagination`, `PagedResult<T>`, plus `ResultData<T>`. |
| `expense.ts`      | Zod `ExpenseSchema`/`ExpenseCategorySchema` + inferred types, plus `NewExpense`/`NewExpenseCategory` interfaces (client→server payloads). |
| `asset.ts`        | Same shape for assets: `AssetSchema`, `AssetCategorySchema`, `NewAsset`, `NewAssetCategory`.        |
| `earning.ts`      | Zod schemas + view types for `EarningRule`/`Earning`/exceptions (`NewEarningRule`, `NewEarning`, `EarningRuleView`, `EarningView`, `ProjectedOccurrenceView`, `IncomeAverage`). |
| `debt.ts`         | Zod schemas + view types for debts and payments (`NewDebt`, `DebtView`, `DebtPaymentView`, `ProjectedDebtPaymentView`, `RecordDebtPaymentSchema`). |
| `budget.ts`       | Zod schemas + view types for buckets (`NewBucket`, `BucketView`, `BucketHealth` = ok\|warning\|overdrawn, `AllocateEarningInput`). |
| `next-auth.d.ts`  | Augments NextAuth `User`/`Session`/`JWT` with `id`, `email`, `role`.                                |
| `types.d.ts`      | Older, conflicting NextAuth `User` augmentation. Effectively dead (see OVERVIEW). Not typechecked because of `skipLibCheck`. |

### `src/lib/` — server-side core

| File               | Exports / role                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `auth.ts`          | **The auth hub.** `NextAuth()` config (Credentials provider, bcrypt compare, JWT 7-day sessions, custom pages), exports `handlers, signIn, signOut, auth`, plus `requireRole(roles[])` (redirects to `/auth/login` or `/unauthorized`) and `getUserId(): Promise<string \| null>`. Every server action starts by calling `getUserId()`. |
| `prisma.ts`        | `export const dbClient: PrismaClient` — a bare `new PrismaClient()`. **Import name is `dbClient`, not `prisma`.**          |
| `errors.ts`        | `UserInputError` — thrown by validators, caught in actions to surface a message to the user.                              |
| `validators.ts`    | `validateEmail`, `validatePassword` — throw `UserInputError`.                                                             |
| `schemas.ts`       | `emailSchema`, `passwordSchema` (6+ chars w/ complexity rules, or 16+ char passphrase), `registerSchema`, `PaginationSchema`, a `.strict()` `FilterOpsSchema` (unknown operators rejected), and **`makeQueryInputSchema(allowedFields)`** — a factory binding a query schema to one model's field allowlist. |
| `query-builder.ts` | `QuerySerializer<T, Field>` class — validates raw input against the model's allowlist, `transform()` returns Prisma args (`where`/`orderBy`/`take`/`skip`); `pageInfo` getter exposes the effective page/limit. `parseFilters` maps `contains/eq/in`, `min/max`→`gte/lte`, `before/after`→`lt/gt`. **`userId` is forced into `where` *after* the filter spread — that is the tenancy boundary; never move it.** |
| `query-fields.ts`  | Per-model field allowlists (`EXPENSE_QUERY_FIELDS`, `ASSET_QUERY_FIELDS`, + both category models), typed `Extract<keyof T, string>` so a typo is a compile error. **A field is only queryable if listed here.** |
| `recurrence.ts`    | **Pure** occurrence expansion for recurring rules — no Prisma, no `Decimal`. One implementation serves projection (today → horizon, computed), materialisation (watermark → today, written), and the future catch-up checker, so the UI and the writer can never disagree about when a rule fires. Phase 2's debt schedule reuses it. |
| `dates.ts`         | UTC date helpers. `@db.Date` round-trips as UTC midnight; local-time accessors (`getMonth`, `setDate`) shift the day for anyone west of UTC and silently move pay dates. **Use these anywhere a `@db.Date` is involved.** |
| `format.ts`        | `formatCurrency`, `formatDay` — shared display formatting. `formatDay` forces `timeZone: "UTC"` for the reason above. |
| `zodMantine.ts`    | `zodValidate(schema)` → Mantine `useForm` `validate` function (first error per field).                                     |
| `querys/query.ts`  | Empty file.                                                                                                              |
| `querys/types.ts`  | Fully commented out. Both `querys/` files are abandoned scaffolding.                                                       |

### `src/services/`

- `factory.service.ts` — `getModelData(modelDelegate, serializer, select?)`, a generic paginated
  find+count helper returning `PagedResult<T>` (`{ data, meta }`). Tenancy comes from the serializer,
  so there is no `fixedWhere` parameter to get wrong. Compiles and is correct, but **has no caller
  yet** — staged for the Phase 1+ models.

### `src/constants.ts`

`DEFAULT_USER_ROLE`, `ADMIN_USER_ROLE`, `INVALID_INPUT_ERROR`, `SALT_ROUNDS` (10),
`DEFAULT_PAGINATION` (50), `MAX_PAGINATION` (1000).

### `src/app/` — routes

```
layout.tsx            Root layout → <Providers>
providers.tsx         SessionProvider + MantineProvider (localStorage color scheme key "mantine-color-scheme")
page.tsx              Public landing page ("Welcome to FinanceApp" copy — brand mismatch, app is "Folio")
globals.css           Base resets + light/dark CSS vars
page.module.css       create-next-app leftover

api/auth/[...nextauth]/route.ts    re-exports { GET, POST } from @/auth

auth/login/page.tsx        client page, redirects to /dashboard if already authenticated
auth/login/LoginForm.tsx   the form
auth/login/actions.tsx     loginWithCredentials() — client-side signIn wrapper mapping NextAuth error codes
auth/register/page.tsx     + RegisterForm.tsx
auth/register/actions.tsx  "use server" registerUser() (validate → dup check → bcrypt → create), loginUser()

dashboard/layout.tsx       server layout: await requireRole(["*"]) then <DashboardShell>
dashboard/page.tsx         server page: parallel-fetches summaries and renders <DashboardGridClient>
dashboard/DashboardLayout.tsx  older/alternate server dashboard body — NOT routed, superseded by page.tsx
dashboard/summary-db.ts    "use server" aggregation helpers (see below)
dashboard/charts/page.tsx  stub — just a "Charts" title
dashboard/earnings/        Earnings: rules table, pending-confirmation banner, occurrence table,
                           projected table w/ skip+override, income averages card
dashboard/budget/          Budget buckets: bucket cards (green/yellow/red), allocation panel
dashboard/debts/           Debts: debt list, payments table, projected-payments table w/ skip+override,
                           record-a-payment form. Projections cap against a running balance and stop
                           at payoff — the posting rule applied to the display, NOT amortization.
dashboard/settings/        SettingsPage + DisplayNameSetting(+WithSession) — UI only, no persistence yet
dashboard/expenses/        expenses CRUD page (see below)
dashboard/worth/           assets CRUD page (see below)
dashboard/_widgets/        dashboard widgets (see below)
```

#### `dashboard/summary-db.ts` — all dashboard aggregation

Every function calls `getUserId()` and throws `"Unauthorized"` if absent.

- `getDashBoardSummary({month?})` → `{ total, categories: CategorySlice[], topBar }` — expense totals
  grouped by category; `topBar` is top 4 + an aggregated `"Others"` slice.
- `getMonthTotals()` → `{ current, previous, deltaPct }` — this month vs last month expenses.
- `getMonthlyTrend(months = 6)` → `MonthTotal[]` — expenses bucketed by `"MMM YY"` label.
- `getMonthlyAssetTrend(months = 6)` → same for assets.
- Types `CategorySlice { label, value, percent }`, `MonthTotal { month, total }`, `DashboardSummary`.
- Bucketing is done in JS with a `Map` keyed by `toLocaleString("default", {month:"short", year:"2-digit"})`.

#### `dashboard/_widgets/`

| File                            | Role                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DashboardGridClient.tsx`       | Thin `"use client"` wrapper: `dynamic(() => import("./DashboardGrid"), { ssr: false })`. Exists because react-grid-layout can't SSR. Server pages import **this**, never `DashboardGrid` directly. |
| `DashboardGrid.tsx`             | The dashboard itself. `GridLayout` 12 cols, `rowHeight` 42, layout persisted to `localStorage["dashboard-layout"]`. "Rearrange" toggle flips widgets between `static` and draggable/resizable (`draggableHandle=".drag-handle"`). Holds `DEFAULT_LAYOUT` (4 widgets: `expense-stats`, `category-donut`, `spending-trend`, `expense-income`) and `CHART_COLORS`. |
| `DashboardGrid.module.css`      | Grid/widget styling.                                                                                                                                   |
| `StatsSegmentsExpenses.tsx`     | Month-to-date total + segmented `Progress` bar by category + per-category cards + MoM delta arrow. Note: "up" is styled red (spending more = bad).       |
| `StatsSegmentsExpenses.module.css` | Its styles.                                                                                                                                          |
| `ExpenseIncomeChart.tsx`        | **The only Unovis chart.** `VisXYContainer` + two `VisArea` (expenses red `#ff6b6b`, assets green `#69db7c`) + `VisAxis` + `VisBulletLegend`, with 3M/6M/12M toggle. Accessors (`x`, `yExpenses`, `yAssets`) are module-level constants on purpose — Unovis re-renders badly if accessors are new closures each render. Follow this pattern for new Unovis charts. |

#### `dashboard/expenses/`

- `page.tsx` — `"use client"`, holds `expenses`/`categories` state, `refreshData()` re-fetches both in
  parallel after every mutation. Also renders a **"Query Serializer Test Bench"** dev panel that fires a
  hardcoded query at `expenseApi()`.
- `actions.tsx` — `"use server"`: `addExpense`, `updateExpense`, `getUserExpenses` (flattens
  `category` relation and converts `Decimal → number` via `.toNumber()`), `expenseApi(query)` (uses
  `QuerySerializer`).
- `ExpenseTable.tsx` — inline per-cell editing (`title`/`amount`/`category`/`date`) with draft +
  dirty-field tracking, submit via an `IconSend` action icon.
- `NewExpenseForm.tsx` — modal form for creating an expense.
- `categories/actions.tsx` — `addCategory`, `updateExpenseCategory`, `getCategoryById`,
  `getCategoryByTitle`, `getUserExpenseCategories`. Handles Prisma `P2002` (dup title) explicitly.
- `categories/ExpenseCategoryForm.tsx` — exported as `CategoryManager`; add + edit categories via Mantine `useForm`.

#### `dashboard/worth/` (assets / net worth)

Mirrors `expenses/` almost 1:1 — `page.tsx`, `actions.tsx` (`addAsset`, `updateAsset`,
`getUserAssets`, `assetApi`), `AssetTable.tsx`, `NewAssetForm.tsx`, `categories/actions.tsx`
(`addAssetCategory`, `updateAssetCategory`, …), `categories/AssetCategoryForm.tsx`.

Asset-specific: `isCash` boolean (rendered as a `Switch`/`Badge`), and `NewAssetForm` has an
"also add to expenses" toggle that lazily loads expense categories and calls `addExpense` from the
expenses module — the one cross-module dependency between the two features.

### `components/` (root-level, `@/components/*`)

| File                  | Role                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DashboardShell.tsx`  | Mantine `AppShell` (header 60px, navbar 175px, `md` breakpoint) + framer-motion `AnimatePresence` keyed on pathname. |
| `DashboardNavbar.tsx` | Nav links: Dashboard, Expenses, Worth, Charts, Settings. Active state via `data-active`. Shows app version from `package.json`. |
| `LoggedInHeader.tsx`  | Title + session email/name + logout + theme toggle.                                                          |
| `IndexHeader.tsx`     | Public header with Log in / Sign up buttons (`showLogin`/`showSignup` props).                                 |
| `ThemeToggler.tsx`    | Mantine color-scheme toggle; returns `null` before mount to avoid hydration mismatch.                         |

### `css/` (root-level, `@/css/*`)

`NavbarSimple.module.css`, `TableSort.module.css`, `GradientSegmentedControl.module.css` — Mantine
recipe styles using `light-dark(var(--mantine-color-…))`.

---

## Conventions an agent must follow

1. **Data access is server actions only.** Files start with `"use server"`; the only API route is
   NextAuth's catch-all. Don't add REST routes without a reason.
2. **Every server action starts with `const userId = await getUserId();`** and `redirect("/auth/login")`
   if null. Every Prisma query is scoped by `userId` — this is the only tenancy boundary. Never write a
   query that can read another user's rows.
3. **Return `ActionResult`** (`{ok:true} | {ok:false, error}`) from mutations. Read actions return domain
   arrays directly and throw/redirect on failure. (`expenses/categories/actions.tsx#addCategory` is the
   one legacy exception — it returns `{ok:false, message}`.)
4. **`Decimal` never crosses to the client.** Convert with `.toNumber()` in the action before returning.
5. **Prisma client import is `import { dbClient } from "@/lib/prisma"`.**
6. **Client pages own their data.** Expenses/Worth pages are `"use client"` with a `refreshData()`
   callback re-run after every mutation; the dashboard page is a server component that fetches in
   `Promise.all`.
7. **Mantine first for UI.** New charts should use **Unovis** (`ExpenseIncomeChart` is the reference);
   existing `@mantine/charts` donut/bar widgets stay until migrated.
8. **Anything using `react-grid-layout` must be dynamically imported with `ssr: false`.**
9. **Every queryable model needs a field allowlist** in `src/lib/query-fields.ts`. `QuerySerializer`
   rejects any `filters`/`sort` key not listed, so arbitrary field names never reach Prisma. Adding a
   model without one means it can't be queried; widening one is a deliberate act.
10. Formatting is Prettier (120 cols, double quotes, semicolons). Run `npm run prettier` before finishing.

## Fast lookup — "where do I go for…"

| Task                                | File                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| Add a DB field                      | `prisma/schema.prisma` → `npx prisma migrate dev` → `types/` |
| Change auth / roles / session shape | `src/lib/auth.ts`, `types/next-auth.d.ts`                  |
| New dashboard widget                | `src/app/dashboard/_widgets/`, register in `DEFAULT_LAYOUT` in `DashboardGrid.tsx` |
| New aggregation / chart data        | `src/app/dashboard/summary-db.ts`                          |
| Filtering / pagination / sorting    | `src/lib/query-builder.ts` + `makeQueryInputSchema` in `src/lib/schemas.ts`; add the field to `src/lib/query-fields.ts` |
| Add a nav item                      | `components/DashboardNavbar.tsx` (`data` array)            |
| Recurring-schedule maths            | `src/lib/recurrence.ts` (pure) — never reimplement per feature |
| Any `@db.Date` arithmetic           | `src/lib/dates.ts` (UTC-safe); display via `formatDay`     |
| Earnings / income averages          | `src/app/dashboard/earnings/actions.tsx`                   |
| Debts / payment schedule            | `src/app/dashboard/debts/actions.tsx`                      |
| Budget buckets / allocation         | `src/app/dashboard/budget/actions.tsx`                     |
| Validation rules                    | `src/lib/schemas.ts`, `src/lib/validators.ts`              |
| Expense CRUD                        | `src/app/dashboard/expenses/actions.tsx`                   |
| Asset CRUD                          | `src/app/dashboard/worth/actions.tsx`                      |

## Status

The repo **typechecks and builds** as of 2026-09-03 (Phases 0, 1 and 2 complete). Run `npx prisma generate`
before any typecheck or you'll see ~20 phantom `@prisma/client` errors that aren't real.

Read `CURRENT.md` for what's actively being worked on, the settled design decisions, and known minor
bugs and gotchas. `OVERVIEW.md` § 5 has the remaining issues. **B5 and B19 are now fixed** — nothing blocking remains.
