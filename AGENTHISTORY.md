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
