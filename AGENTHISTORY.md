# AGENTHISTORY.md — Agent Session Log

Append-only log of AI agent work on this repo. **Never edit or delete previous entries** — add a new one
at the bottom. This is the record of what was tried, what worked, and what traps were hit, so the next
agent doesn't rediscover the same things.

## How to use this file

At the **start** of a session: read `INDEX.md`, then `CURRENT.md`, then `OVERVIEW.md`, then skim the
last 2–3 entries here.

At the **end** of a session: **when the user asks for a doc update**, append an entry using the template
below. Also update `CURRENT.md` (task state, minor bugs), `OVERVIEW.md` (tick off tasks, add newly found
bugs), and `INDEX.md` (if you added, moved, or deleted files).

**Don't append here as you go.** Wait to be prompted. The two exceptions — a significant bug found
off-task, and context that took real effort across several prompts to pin down — are spelled out in
`INDEX.md` § Rules for agents, rule 5. Not every session warrants an entry.

Keep entries factual and short. Record what a future agent could not learn by reading the diff:
non-obvious causes, dead ends, things you verified, things you assumed.

### Entry template

```markdown
## YYYY-MM-DD — <short title>

**Agent:** <model / tool> · **Branch:** <branch> · **Commits:** <shas or "none">

**Task:** what was asked.

**Changed:**

- `path/to/file.ts` — what and why.

**Learned:** non-obvious facts about the codebase discovered this session.

**Traps / dead ends:** what didn't work and why, so nobody repeats it.

**Verified:** what was actually run (`npm run build`, `tsc --noEmit`, manual click-through) and the result.
Say plainly what was *not* verified.

**Left undone:** anything started but incomplete, or discovered and deferred (also add to `OVERVIEW.md`).
```

---

## 2026-08-26 — Repo survey and documentation bootstrap

**Agent:** Claude Opus 5 (Claude Code) · **Branch:** `feature/dashboard-integeration` · **Commits:** none (docs only, uncommitted)

**Task:** Read the freshly cloned repo and create `INDEX.md`, `OVERVIEW.md`, and `AGENTHISTORY.md` as
the starting context for future agents.

**Changed:**

- `INDEX.md` — new. Full file-by-file map, stack, commands, path aliases, data model, conventions.
- `OVERVIEW.md` — new. Goals (inferred, need owner confirmation), current status table, task list, 16 known issues.
- `AGENTHISTORY.md` — new. This file.

No source files were modified.

**Learned:**

- Path aliases are unusual: `components/`, `css/`, and `types/` sit at the **repo root**, outside `src/`.
  `@/*` maps to `src/*` only.
- The Prisma client export is named **`dbClient`**, not `prisma`.
- `src/app/dashboard/DashboardLayout.tsx` and `src/app/dashboard/layout.tsx` are different things —
  the former is dead code, the latter is the real route layout.
- `DashboardGridClient.tsx` exists solely to `dynamic(..., { ssr: false })` the grid; server components
  must import the client wrapper, never `DashboardGrid` directly.
- `ExpenseIncomeChart.tsx` keeps its Unovis accessor functions at module scope deliberately (comment in
  file: "no closure over component state"). It is the only Unovis chart so far and is the reference
  pattern for the planned migration off `@mantine/charts`.
- `tsconfig.json` sets `skipLibCheck: true`, which is why the invalid `id: integer` in
  `types/types.d.ts` never surfaces as an error.
- `worth/` is a near-copy of `expenses/`; the one coupling is `NewAssetForm`'s "also add to expenses"
  toggle, which imports `addExpense` and `getUserExpenseCategories` from the expenses module.

**Traps / dead ends:**

- Running `npx tsc --noEmit` on a fresh clone produces ~20 misleading errors
  (`Module '"@prisma/client"' has no exported member 'PrismaClient'` and cascading implicit-`any`s).
  These are **not** code bugs — the generated Prisma client isn't committed. Run `npx prisma generate`
  first. Do not "fix" these in source.
- The single reported error on the pristine tree (`query-builder.ts(71,1): '}' expected`) masks
  everything else: TypeScript stops after the parse failure in that file, but the other files' errors
  only appear once it's fixed.

**Verified:**

- `npx tsc --noEmit` on the working tree: **1 error**, the `query-builder.ts` syntax error.
- Typechecked a throwaway copy of `HEAD` with a single `}` appended to `query-builder.ts` to see past
  the parse error: **29 errors**, of which ~20 are the Prisma-generate artifact above. The real ones are
  logged as B1–B4 in `OVERVIEW.md`.
- Confirmed `@mui` is absent from `node_modules` (so `src/app/theme.ts` is genuinely broken) and that
  nothing imports `src/app/theme.ts`.
- Confirmed no `postcss.config.mjs` exists despite `postcss-preset-mantine` being installed.
- **Not verified:** the app was never run. No `npm run dev`, no `npm run build`, no database, no browser
  click-through. Runtime behavior of every feature is unconfirmed.

**Left undone:**

- All 16 issues in `OVERVIEW.md` § 5 are open, including the P0 build break. Nothing was fixed.
- Goals in `OVERVIEW.md` § 2 are inferred from code and commit messages — the project owner should
  confirm or replace them.
- Open questions in `OVERVIEW.md` § 7 (fate of the generic query layer; whether assets are snapshots or
  balances) need a human decision before the query layer or the net-worth chart can be finished
  correctly.

---

## 2026-08-31 — Dev environment restore on CachyOS, root-route diagnosis, doc restructure

**Agent:** Claude Opus 5 (Claude Code) · **Branch:** `feature/dashboard-integeration` · **Commits:** none

**Task:** Get the project running again after ~4 months idle on a new machine (Windows → CachyOS);
diagnose why the browser showed nothing at `localhost:3000`; restructure the agent docs.

**Changed:**

- `.env` — **created** (repo root, gitignored, `chmod 600`): `DATABASE_URL`, `NEXTAUTH_URL`,
  `NEXTAUTH_SECRET` from `openssl rand -base64 32`. The only non-doc file touched all session.
- `CURRENT.md` — **new.** Current task / Long term goals / Known minor bugs / Old tasks archive.
- `INDEX.md` — added **Rules for agents** at the top; "three docs" → "four docs"; documented the
  `CURRENT.md` vs `OVERVIEW.md` split; added guidance to read only the leading sections of each doc.
- `AGENTHISTORY.md` — rewrote "How to use this file" to match the new prompted-update policy.
- **No source files were modified.**

**Learned:**

- `next-auth` v5 reads `AUTH_SECRET` first and falls back to `NEXTAUTH_SECRET`
  (`node_modules/next-auth/lib/env.js:22`). `NEXTAUTH_SECRET` is correct here and matches
  `docker-entrypoint.sh`.
- `next dev` binds `*:3000` — both stacks. `localhost`, `127.0.0.1`, and `[::1]` all return 200.
- CachyOS/Arch ships the Docker CLI without the Compose plugin: `sudo pacman -S docker-compose`. The
  daemon also starts inactive+disabled, and the `docker` group exists but is empty.
- `docker compose` only starts Postgres. The app runs on the host via `npm run dev`; the `Dockerfile`
  is unused in local dev.
- Expenses require an existing category — `addExpense` rejects otherwise. Create a category first.

**Traps / dead ends:**

- **The root page's HTML contains `404: This page could not be found.` three times, and it is a red
  herring.** It lives only inside `<script>self.__next_f.push(...)` — the RSC flight payload where
  Next 15 ships its default not-found boundary. Stripping `<script>` tags leaves 4,105 bytes of DOM out
  of 19,875, containing only the landing page. Never grep raw page source for "404" and conclude the
  route failed.
- Reading code to explain "browser shows nothing" was the wrong instinct. The decisive signal was the
  **absence** of any `GET /` line in the dev server log: requests are logged, so no line means the
  request never arrived, which localizes the fault to the browser in one step.
- Chased an IPv6-vs-IPv4 loopback theory. **Ruled out** — the server binds both.

**Verified:**

- `folio-db-1` healthy on 5432; `prisma generate` + `migrate deploy` applied all 6 migrations to
  `folio_dev`.
- `curl`: 200 on all three loopback addresses, identical 19,875-byte body; dev log confirmed
  `GET / 200`. Headers show `X-Powered-By: Next.js`, chunked, `no-store`.
- Ruled out as causes of the reported "not found": no `middleware.*` anywhere, `next.config.ts` empty
  (no `basePath`/rewrites/redirects), no route groups, no `not-found.tsx`/`error.tsx`, no `pages/` dir.
  `src/app/page.tsx` exports a valid component.
- **Not verified:** I never exercised the app in a browser, entered data, or completed a build —
  B1 is still unfixed, so `npm run build` and a full `tsc --noEmit` would still fail.

**Left undone:**

- **B1 unfixed** — `src/lib/query-builder.ts` missing a closing brace. `/dashboard/expenses` and
  `/dashboard/worth` won't compile, which blocks all data entry. Now listed at the top of
  `CURRENT.md` § Known minor bugs as well as `OVERVIEW.md` § 5.
- All other `OVERVIEW.md` § 5 issues remain open; no code was fixed.
- Long term goals in `CURRENT.md` are still inferred, not owner-confirmed.
- The Zen browser issue was resolved by the user; the cause was deliberately not recorded, at their
  request. If it recurs on another machine, it will need re-diagnosing from scratch.

---

## 2026-09-01 — Phase 0 planned, executed in a separate thread, then reviewed

**Agent:** Claude Opus 5 (Claude Code) · **Branch:** `feature/phase0-groundwork` · **Commits:** none — the Phase 0 code is still uncommitted

**Task:** Plan Phase 0 (groundwork) and write a handoff prompt; a separate thread executed it; then
review that work and update the docs.

**Changed (this thread):** documentation only — `OVERVIEW.md` §§ 2-7, `CURRENT.md` (Build sequence,
bug table), `INDEX.md` (file map, data model, commands, conventions, status). All Phase 0 *code* was
written by the other thread; see `OVERVIEW.md` § 6 for that record.

**Learned:**

- **`react-grid-layout` 2.2.3 ships `react-grid-layout/legacy`**, a supported v1-compatibility wrapper
  exporting `ReactGridLayout`, `WidthProvider`, `Layout`, `LayoutItem`. Its `LegacyReactGridLayoutProps`
  keeps the flat v1 props (`cols`, `margin`, `layout`, `draggableHandle`). This turned B3 from a rewrite
  into an import swap. `Layout` is `readonly LayoutItem[]`, so state updates need copy-on-write, and
  `margin` is a `readonly [number, number]` tuple that a JSX array literal won't satisfy.
- **Changing `@db.Money` → `@db.Decimal(12,2)` requires no application code changes.** Prisma maps both
  to the same `Decimal` TypeScript type, so existing `.toNumber()` call sites are untouched. Worth
  knowing before anyone budgets time for a large refactor.
- A stale `@types/react-grid-layout@1.3.6` was installed alongside v2's bundled types. Removed.

**Traps / dead ends:**

- **The plan assumed an empty database. It wasn't** — 1 user, 2 expenses, 2 assets. `prisma migrate dev`
  refuses to run non-interactively when it detects possible data loss, which blocks the obvious path.
  The working route: `pg_dump` a backup, inspect the SQL from `migrate diff`, apply with
  `migrate deploy`, then verify values survived the cast. Postgres casts `money → numeric` cleanly.
- **B8 and B13 were fixed by the owner's own frontend cleanup, not by Phase 0.** Don't attribute them to
  the query-layer work when reading the history.

**Verified** (independently — I re-ran everything rather than trusting the executing agent's report):

- `npx tsc --noEmit` → exit 0, no output.
- `prisma migrate status` → up to date, 7 migrations, no drift.
- `information_schema`: both `amount` columns are `numeric(12,2)`; `Expense.description` is `varchar`.
- Data intact after the cast — `4169.34`, `11400.00`, `550.00`, `250.00` all exact; row counts unchanged.
- Read the full diff: **`userId` is still forced after the filter spread** (the tenancy boundary), and
  `parseFilters`'s operator mapping is byte-identical to the original.
- Owner confirmed the dashboard rearrange/drag/resize/persist cycle by hand — the one gap the executing
  agent couldn't cover without browser automation.

**Found — B17 (new).** `query-builder.ts:96` uses `else if (fieldOps.eq)`, so `eq: false` / `eq: 0` fail
the truthiness test and the filter is silently skipped, returning every row. Pre-existing logic, but
newly *reachable* because Phase 0 added `boolean` to `FilterOpsSchema.eq` and `isCash` to
`ASSET_QUERY_FIELDS`. Logged in `OVERVIEW.md` § 5 and `CURRENT.md`.

**Left undone:**

- **B17 is unfixed** — fix before Phase 1 filters on a boolean.
- **The `feature/phase0-groundwork` branch is uncommitted.**
- `src/lib/querys/` still present; the dev test bench is still in `expenses/page.tsx` (now with a second
  blocked-field button); `factory.service.ts` compiles but has no caller.
- B5 (tenancy bug in `getCategoryById`), B6, B9-B12, B14-B16 all still open.

---

## 2026-09-01 — Phase 1 (Earnings + budget allocation) executed in a separate thread, then reviewed

**Agent:** Claude Opus 5 (Claude Code) · **Branch:** `limit-testing` · **Commits:** none — Phase 1 is uncommitted

**Task:** Write the Phase 1 kickoff prompt; a separate thread built it; then review that work and do
the doc pass. (Phase 0 landed as `d52de80` before this.)

**Changed (this thread):** documentation only — `INDEX.md` (new rule 7, Phase 1 file map, data model),
`CURRENT.md`, `OVERVIEW.md`, this file.

**Learned:**

- **The Phase 1 schema is the template Phases 2-3 must follow.** `EarningException` is explicitly
  designed so the debt payment override is structurally identical, and `src/lib/recurrence.ts` is pure
  (no Prisma, no `Decimal`) so the debt schedule reuses it rather than reimplementing. Read both before
  starting Phase 2.
- **`@@unique([ruleId, scheduledDate])` is what makes auto-posting idempotent**, and it relies on
  Postgres treating NULLs as distinct so unlimited one-off earnings never collide on it.
- **`scheduledDate` is deliberately separate from `date`.** Overriding an occurrence's actual date must
  not make the projector think the slot is unfilled and re-emit it.
- **"Buckets fund from actual income" is enforced by the schema, not by discipline.** A projected
  occurrence is computed and has no row, so `BucketAllocation.earningId` has nothing to reference.
  There is no code path that can allocate projected income.
- `@db.Date` round-trips as UTC midnight. Local-time accessors shift the day west of UTC — this is why
  `src/lib/dates.ts` exists and why `formatDay` forces `timeZone: "UTC"`.

**Traps / dead ends:**

- **A verification script deleted the owner's hand-entered test data.** Its cleanup was
  `deleteMany({ where: { userId } })` — written in an earlier session when those tables held only
  agent-created rows. This repo runs in bypass-permissions mode, so nothing blocked it. **This is now
  `INDEX.md` rule 7:** ask before deleting or modifying existing data, back up first, and scope deletes
  to ids the script itself created.
- Don't trust a "verified" claim about pre-existing behaviour without checking scope. The Phase 1 agent
  reported that `ExpenseTable`/`AssetTable` were "likely showing off-by-one dates already"; the picker
  is affected (B19) but the read-only text is not, because it formats via `toISOString()`.

**Verified** (re-ran everything rather than trusting the report):

- `npx tsc --noEmit` → exit 0. `npm run build` → succeeds, with `/dashboard/earnings` and
  `/dashboard/budget` both emitted. `prisma migrate status` → 8 migrations, no drift.
- Schema read against all fifteen design decisions in `CURRENT.md` — gross+net with no deduction model,
  deposit-date anchoring, rule+occurrence+exception, shared `PostingStatus`, per-bucket rollover,
  `lastMaterializedThrough` leaving room for the catch-up checker. All honoured.
- **Averages are advisory only** — no reference to `getIncomeAverages` or `ROLLING_AVERAGE_WINDOWS`
  anywhere under `budget/`, and allocation requires `status === CONFIRMED`.
- B17 fix confirmed in source, applied to `contains`/`eq`/`in`. B18 fix read and reasoned through:
  numerator `CONFIRMED`-only over a denominator of total history is correct and rises monotonically.
- Field allowlists added for all four new queryable models, per convention 9.
- **Not verified by me:** no browser click-through. The owner exercised the feature by hand — that is
  how B18 was found — and confirmed the flow works.

**Left undone:**

- **Phase 1 is uncommitted on `limit-testing`.**
- **B19 open** (off-by-one in the two edit pickers). B5 (tenancy bug in `getCategoryById`), B6, B9-B12,
  B14-B16 all still open.
- `feature/phase0-groundwork` is a stale branch with none of the Phase 0 work on it — delete it.
- `README.md` § "Coding with Agents" still tells agents the repo doesn't compile.
- Two design calls were made without asking, against the prompt's instruction: deleting a
  rule-generated occurrence writes a SKIP exception, and allocating an earning whose month has closed
  funds the current month. Both disclosed, both accepted by the owner.
