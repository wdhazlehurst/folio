# CURRENT.md — Task at Hand

Fast-moving working doc. What's being worked on **right now**, where the project is headed, and small
bugs not worth a full entry in `OVERVIEW.md`.

**Read the first three sections** (Current task, Long term goals, Known minor bugs). **Old tasks** at
the bottom is archive — skip it unless something there is directly relevant to what you've been asked
to do.

**Last updated:** 2026-09-01

---

## Current task

> **Agents: do not edit this section unless explicitly told to** (`INDEX.md` § Rules for agents, rule 6).
> If you think it should change, ask first.

**Build the data-model foundation for recurring finance tracking.** Today Expenses, Assets, and the
Worth number are flat entries with no recurring or derived logic. This task replaces that with real
models. Build in this order — each is the foundation for the next.

1. **Earnings** — a real recurring-income model, not a flat Worth bump. Includes the rolling monthly
   average (3/6/12-month), designed to support multiple income streams later. Everything else hooks
   into this.
2. **Minimal allocation layer** — envelope-style budget buckets drawing off Earnings, percentage or
   dollar based, with the yellow (nearing zero) and red (overdrawn) states. Does **not** need to be
   polished. It needs to exist so Debts and Investments plug into something real instead of being
   isolated calculators.
3. **Debts** — a dedicated model, separate from Expenses (which keeps holding flat actual payments).
   Fields: balance, interest rate, minimum payment. Wire it into the allocation layer from step 2.
4. **Investments** — a dedicated model, separate from Assets/Worth (which keeps holding flat actual
   asset bumps). Support the major account types as distinct entries — HSA, Roth IRA, Traditional IRA,
   401k, standard savings — each drawing from the same income/allocation pool.

**Scope limit:** don't build Investments in full depth yet. No contribution limits, no employer-match
tracking, no per-account growth rates. Basic category and data model only — the owner's actual benefit
elections aren't finalized, so those details are still moving.

**Structural requirement:** build these so they *grow into* the Long term goals below rather than get
rebuilt later. The vision in that section is the design target, not a someday wishlist.

### Build sequence

Decision: model Earnings and the allocation layer **together** in one migration (they're tightly
coupled), then vertical slices for Debts and Investments.

- **Phase 0 — groundwork.** ✅ **Complete 2026-09-01** (branch `feature/phase0-groundwork`).
  `Expense.amount` and `Asset.amount` migrated to `Decimal(12,2)`, `Expense.description` added, and the
  query layer rewritten with per-model field allowlists. Closes B1, B2, B3, B4, B7. `tsc --noEmit` is at
  0 errors and `npm run build` succeeds. **The database was not empty** — existing rows were preserved
  through the `money → numeric` cast via `migrate diff` + `migrate deploy` after a backup. Rates
  (`Decimal(6,4)`) were **not** added; no model needs them until Phase 2 Debts.
  See `OVERVIEW.md` § 6 for the full record.
- **Phase 1 — Earnings + allocation.** Both models in one migration, then actions, then UI.
- **Phase 2 — Debts.** Full vertical slice: schema → actions → UI, wired into allocation.
- **Phase 3 — Investments.** Basic model only (see Scope limit). Rename the Worth page to Assets here.

### Design decisions — resolved 2026-08-31

Settled with the owner. Treat these as given; don't relitigate them without asking.

**Data model**

- **Net worth = Assets + Investments − Debts**, three separate tables summed. Investments own their
  balances; `Asset` keeps only non-investment holdings. Nothing writes into `Asset` on contribution, so
  there's no double-counting.
- **All money is `Decimal(12,2)`**, rates `Decimal(6,4)`. Postgres `MONEY` is being retired everywhere —
  it's locale-dependent and awkward for the arithmetic amortization and projections need.
- **Accounts hold a current balance *plus* a snapshot history table.** Current balance answers "what do
  I have"; snapshots feed the net-worth-over-time chart. This supersedes the old ambiguity in
  `getMonthlyAssetTrend`, which summed assets by `date` and so read as "acquired that month" rather than
  "net worth that month".
- **`Asset.isCash` stays.** It's a *liquidity* flag — a checking account versus a Pokémon card
  collection that holds market value but isn't readily converted. This is what the eventual
  emergency-fund calculation needs, and it's distinct from the standard-savings Investment type.
- **Single income stream for now.** No `IncomeSource` model or source field yet; may change later.

**Recurring & posting**

- **Rules generate occurrences.** Occurrences must be editable and deletable, and rules themselves
  modifiable and removable — a wrong entry has to be fixable.
- **Earnings store gross and net**, with no deduction model; taxes are entered manually for now. The
  owner's take-home is post-tax. Recurring earnings carry **the date the money hits the account**.
  Longer term the goal is full automatic deduction modeling (see Long term goals) — build so that can
  be added rather than retrofitted.
- **Auto-post, then verify.** When a scheduled date passes, the entry posts automatically; on next login
  the user is prompted to **Confirm** or **Cancel** each newly detected posting. A "change payment"
  option is explicitly out of scope for now.
- **One shared flow for Earnings and Debt payments** — the same status (projected → confirmed /
  cancelled) and the same catch-up logic for both.
- **A launch-time catch-up checker is required eventually.** The app runs locally and isn't always on,
  so on startup it must detect dates crossed since last run and post what's due. Deferred as a feature,
  but the schema must not preclude it.

**Debts**

- Own model, separate from Expenses. Fields: balance, interest rate, minimum payment, **actual set
  payment** (what will really be paid), and a payment date **overridable for a specific month**.
- On posting: decrement the debt balance **and** create an Expense row — money leaving the account is
  an expense.

**Budget allocation**

- **Monthly reset, with a per-bucket rollover flag.** Rollover is opt-in per bucket, so fun money
  accumulates toward larger purchases while everything else resets. Extends naturally to the
  savings-goal and emergency-fund types in the vision.
- **Buckets fund from actual income received**, not from projections.

**Calculations**

- **Rolling averages use trailing day windows** (90/180/365), not calendar months.
- **Backdating is supported *and* partial windows degrade gracefully** — seed history by hand, and label
  averages computed over less than a full window.

**Structure**

- New sibling routes: `/dashboard/earnings`, `/budget`, `/debts`, `/investments`. **Worth is renamed to
  Assets**, since it now holds only flat asset entries while net worth is computed from three sources.
  The Charts page eventually becomes the combined summary view, and the dashboard can show the same.
- **Query layer: fix and adopt, as a scoped rewrite.** See below.

### Two implications to build around

1. **"Rule + generated" and "occurrences must be editable" only reconcile one way.** A purely computed
   occurrence can't hold an edit. So: future occurrences stay **projected** (computed from the rule,
   never stored), and an occurrence **materializes into a real row when its date passes** — that's the
   catch-up checker's job. Edits and deletes apply to materialized rows. Overriding a specific future
   payment date needs a small exceptions table. One mechanism serves the recurring rules, the
   confirm/cancel flow, and the overridable debt payment date.
2. **The trailing average is advisory, not operational.** Buckets fund from actual income received, so
   the 90/180/365-day averages drive planning, projections, and "safe to pull" guidance — never
   allocation itself. Don't wire the average into bucket funding.

### Query layer — scoped rewrite (Phase 0)

Assessment: the intention was sound but the two halves were never wired together. `query-builder.ts`
exports a `QuerySerializer` **class**, while `factory.service.ts` imports a `transformToPrisma`
**function** that has never existed. Keep the concept and the `parseFilters` operator mapping
(`contains`/`eq`/`in`, `min`/`max` → `gte`/`lte`, `before`/`after` → `lt`/`gt`) — that part is good and
reusable across six models. Fix the rest:

- Add a **per-model field allowlist** (`keyof T`). Today `filters` is `z.record(z.string(), z.any())` and
  `sort` accepts any key, so arbitrary field names reach Prisma's `where`/`orderBy`. Tenancy is safe —
  `userId` is forced *after* the spread — but this must not be adopted as-is across four new models.
- Make `QuerySerializer<T>` actually **use `T`**; `rawInput` is currently `any`, so the class provides no
  type safety at all.
- Resolve `select`: it's destructured in `transform()` but absent from `QueryInputSchema`, and both call
  sites override it afterward anyway.
- Make `pagination` optional with defaults.
- Merge the two divergent copies of `FilterOps<T>` (`types/api.ts` and `src/lib/schemas.ts`).
- Rebuild `factory.service.ts` against the class, or fold count/meta into the serializer and delete it.

This closes B1 and B2.

**Also note:** this task means schema changes throughout — expect `prisma/schema.prisma`,
`prisma/migrations/`, `types/`, and new route folders under `src/app/dashboard/` to move together.

---

## Long term goals

Folio is both a learning project and a tool the owner intends to actually use to track real income,
debts, and investments. The product vision below is **owner-provided and confirmed** (2026-08-31) and is
the design target that current work must grow into. The technical goals below it are still inferred from
the code.

### Product vision

**Income**

- Recurring income entries, not just flat asset bumps.
- Rolling average monthly income (3/6/12-month), built to support multiple income streams eventually.

**Budget allocation ("safe to pull")**

- Envelope-style: every dollar of income assigned to a bucket — savings, bills, fun money, debt payoff.
- Bucket goes yellow as it nears zero, red if overdrawn.
- Bills linked to actual recurring expense entries so they auto-deduct from the budget.
- Later: auto-detect recurring expenses and suggest promoting them to "bills."

**Debts**

- Per debt: balance, interest rate, minimum payment.
- Slider for extra payment → recalculated amortization schedule and payoff curve chart.
- Concrete numbers beside the slider: "extra $200/mo saves $X in interest, Y months."
- With multiple debts: avalanche (highest interest first) vs snowball (smallest balance first) toggle.
- Debt paydown feeds the net worth chart — principal paid is net worth up.

**Investments**

- Sliders per account type — HSA, Roth IRA, Traditional IRA, 401k, standard savings — all drawing from
  the same income pool.
- Enforce/flag annual IRS contribution limits per account type. **Configurable, never hardcoded** —
  these change yearly.
- 401k employer-match tracker; flag when contributing below the match threshold.
- Customizable assumed rate of return per account type (HSA cash vs 401k index fund vs savings APY all
  differ).

**Projections**

- 1/3/5/10/20-year rollups, plus an expandable year-by-year table.
- Toggle between nominal and inflation-adjusted dollars.
- Side-by-side comparison: "with current debt" vs "debt-free."

**Also planned**

- Net worth over time chart (assets − debts).
- Emergency fund as its own goal type (target = X months of expenses).
- Goal-based savings buckets, e.g. a car down payment.

**Carried over from the original build**

- Low-friction expense entry: inline table editing and modal quick-add.
- A dashboard the user can rearrange and choose widgets for, persisted per user rather than per browser.
- Light/dark theming throughout.

### Technical

Inferred from the code, not owner-confirmed.


- Type-safe end to end: Prisma → Zod → React, with `Decimal` normalized at the server-action boundary.
- Server actions as the only data path; no hand-rolled REST layer beyond NextAuth.
- One generic, reusable query layer (`QuerySerializer` + `factory.service`) so filter/sort/paginate
  works for every model instead of being reimplemented per feature.
- Migrate all charting onto **Unovis**, using Mantine only for layout and primitives.
- Deployable via Docker with migrations applied on boot.

**Explicitly out of scope for now:** bank/API imports, multi-currency, mobile app.

> Budgets and recurring transactions were previously listed as out of scope. They are now **core** to the
> product vision above.

---

## Known minor bugs

Small stuff — cosmetic, dead code, papercuts. The security issue (B5) lives in **`OVERVIEW.md` § 5**;
resolved items are recorded in `OVERVIEW.md` § 6. IDs match `OVERVIEW.md` numbering; full detail for
each is there.

**Closed by Phase 0 (2026-09-01):** B1, B2, B3, B4, B7. **Closed by frontend cleanup:** B8, B13.

| ID  | Bug                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------- |
| B9  | `dashboard/DashboardLayout.tsx` is dead code superseded by `dashboard/page.tsx`, and its name collides confusingly with `dashboard/layout.tsx`. |
| B10 | `requireRole` redirects to `/unauthorized`, which doesn't exist. Marked `// TODO`. Unreachable today.             |
| B11 | Landing page says "Welcome to FinanceApp" while the app is branded Folio everywhere else.                        |
| B12 | `postcss-preset-mantine` is installed but there's no `postcss.config.mjs`. Nothing breaks today, but Mantine mixins (`@mixin dark`, `rem()`) will silently no-op. |
| B14 | `Dockerfile` uses `RUN chmod +X` (capital X) on the entrypoint, which may leave it non-executable. Should be `+x`. |
| B15 | `new PrismaClient()` at module scope with no `globalThis` singleton — leaks connections across dev HMR reloads.   |
| B17 | ⚠ **Wrong results, silent.** `query-builder.ts:96` tests `else if (fieldOps.eq)`, so `eq: false` / `eq: 0` are skipped and no filter is applied — the query returns *every* row. Newly reachable: Phase 0 added `boolean` to `FilterOpsSchema.eq` and `isCash` to `ASSET_QUERY_FIELDS`. Fix: `fieldOps.eq !== undefined`. **Fix before Phase 1 filters on a boolean.** |
| —   | Branch name typo: `feature/dashboard-integeration`. Harmless; note before merging.                                |

### Gotchas (not bugs — don't "fix" these)

- **The root page's HTML contains `404: This page could not be found.`** three times. It appears only
  inside `<script>self.__next_f.push(...)` — the RSC flight payload where Next.js 15 ships its default
  not-found boundary to the client. It is never rendered. Stripping `<script>` tags leaves only the
  landing page DOM. Viewing page source and finding "404" is misleading.
- **A fresh clone reports ~20 `Module '"@prisma/client"' has no exported member` errors.** The generated
  client isn't committed. Run `npx prisma generate` first. These are not source bugs.

---

## Old tasks

Archive of completed or parked work. **New agents don't need to read this section** unless something in
it is directly relevant to the current task.

### 2026-08-31 — Restoring the dev environment on CachyOS

The project sat untouched for ~4 months and moved from Windows to CachyOS (Arch-based). No prior data
was migrated — the database started empty and is populated by hand.

**Done:**

- Docker installed and daemon enabled; `docker-compose` plugin added (`sudo pacman -S docker-compose`).
- Postgres 18 container up and healthy (`folio-db-1`, port 5432).
- `.env` created at repo root (gitignored, `chmod 600`) with `DATABASE_URL`, `NEXTAUTH_URL`, and a
  freshly generated `NEXTAUTH_SECRET`.
- `npx prisma generate` and `npx prisma migrate deploy` — all 6 migrations applied to `folio_dev`.
- Dev server verified serving the landing page: **HTTP 200** on `localhost:3000`, `127.0.0.1:3000`, and
  `[::1]:3000`, with correct DOM.
- Browser access resolved — the Zen browser now reaches the dev server. The server side was never at
  fault; `curl` had succeeded on every loopback address throughout.

The environment is fully restored. Remaining work to actually populate the app is tracked as B1 under
Known minor bugs, then: register an account, create categories (expenses require an existing category),
and enter data.
