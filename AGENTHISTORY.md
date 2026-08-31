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
