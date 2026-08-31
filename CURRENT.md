# CURRENT.md — Task at Hand

Fast-moving working doc. What's being worked on **right now**, where the project is headed, and small
bugs not worth a full entry in `OVERVIEW.md`.

**Read the first three sections** (Current task, Long term goals, Known minor bugs). **Old tasks** at
the bottom is archive — skip it unless something there is directly relevant to what you've been asked
to do.

**Last updated:** 2026-08-31

---

## Current task

*Nothing active.* No task is assigned — wait to be given one. Don't infer a task from the bug lists
below; they're documented, not assigned.

> **Agents: do not edit this section unless explicitly told to** (`INDEX.md` § Rules for agents, rule 6).
> If you think it should change, ask first.

---

## Long term goals

Inferred from the code and commit history — **not yet confirmed by the project owner.** Replace or
correct these when the real direction is decided.

**Product**

- Low-friction expense entry: inline table editing and modal quick-add.
- Net worth tracked alongside spending, both visible on one screen.
- A dashboard the user can rearrange and choose widgets for, persisted per user rather than per browser.
- Light/dark theming throughout.

**Technical**

- Type-safe end to end: Prisma → Zod → React, with `Decimal` normalized at the server-action boundary.
- Server actions as the only data path; no hand-rolled REST layer beyond NextAuth.
- One generic, reusable query layer (`QuerySerializer` + `factory.service`) so filter/sort/paginate
  works for every model instead of being reimplemented per feature.
- Migrate all charting onto **Unovis**, using Mantine only for layout and primitives.
- Deployable via Docker with migrations applied on boot.

**Explicitly out of scope for now:** bank/API imports, budgets, recurring transactions, multi-currency,
mobile app.

---

## Known minor bugs

Mostly small stuff — cosmetic, dead code, papercuts — plus B1, which is listed here because it blocks
data entry. The remaining build breaks and the security issue live in **`OVERVIEW.md` § 5** (B2, B3,
B5). IDs match `OVERVIEW.md` numbering; full detail for each is there.

| ID  | Bug                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------- |
| B1  | ⚠ **Blocking.** `src/lib/query-builder.ts` is missing the closing brace on the `QuerySerializer` class, so `/dashboard/expenses` and `/dashboard/worth` fail to compile. Those are the only pages where expenses and assets get entered, so the app can't be populated until this is fixed. One-character fix. |
| B4  | `src/app/theme.ts` imports `@mui/material/styles`; MUI isn't installed and nothing imports the file. Dead — delete. |
| B7  | `Expense.description` exists in the Zod type and `NewExpense` but not in the Prisma schema. Code carries a `// FIXME`. |
| B8  | `dashboard/page.tsx` passes the same value as both `monthlyTrend` and `monthlyData`, so two widgets show the same series. The bar widget is titled "6-Month Spending Trend" but is fed 12 months. |
| B9  | `dashboard/DashboardLayout.tsx` is dead code superseded by `dashboard/page.tsx`, and its name collides confusingly with `dashboard/layout.tsx`. |
| B10 | `requireRole` redirects to `/unauthorized`, which doesn't exist. Marked `// TODO`. Unreachable today.             |
| B11 | Landing page says "Welcome to FinanceApp" while the app is branded Folio everywhere else.                        |
| B12 | `postcss-preset-mantine` is installed but there's no `postcss.config.mjs`. Nothing breaks today, but Mantine mixins (`@mixin dark`, `rem()`) will silently no-op. |
| B13 | `StatsSegmentsExpenses.tsx` has a duplicated `"use client"` directive (lines 1 and 4).                            |
| B14 | `Dockerfile` uses `RUN chmod +X` (capital X) on the entrypoint, which may leave it non-executable. Should be `+x`. |
| B15 | `new PrismaClient()` at module scope with no `globalThis` singleton — leaks connections across dev HMR reloads.   |
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
