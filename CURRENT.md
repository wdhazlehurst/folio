# CURRENT.md — Task at Hand

Fast-moving working doc. What's being worked on **right now**, where the project is headed, and small
bugs not worth a full entry in `OVERVIEW.md`. Update this when the task changes or when a small bug is
found or squashed.

**Last updated:** 2026-08-31

---

## Current task

**Restoring the development environment on a new machine.** The project sat untouched for ~4 months and
has moved from Windows to CachyOS (Arch-based). No prior data is being migrated — the database starts
empty and will be populated by hand. No feature goal is set yet; the objective is simply to get the app
running and usable again.

**Done:**

- Docker installed and daemon enabled; `docker-compose` plugin added (`sudo pacman -S docker-compose`).
- Postgres 18 container up and healthy (`folio-db-1`, port 5432).
- `.env` created at repo root (gitignored, `chmod 600`) with `DATABASE_URL`, `NEXTAUTH_URL`,
  and a freshly generated `NEXTAUTH_SECRET`.
- `npx prisma generate` and `npx prisma migrate deploy` — all 6 migrations applied to `folio_dev`.
- Dev server verified serving the landing page: **HTTP 200** on `localhost:3000`, `127.0.0.1:3000`,
  and `[::1]:3000`, with correct DOM.

**Blocked on:**

- The browser (Zen) never reaches the dev server — the Next.js log records zero requests from it while
  `curl` succeeds on every loopback address. The server is confirmed healthy, so the fault is
  browser-side. Waiting to identify Zen's exact error text to pin the cause (DNS / HTTPS-only upgrade /
  URL-bar search / proxy).

**Next, once the browser reaches the app:**

1. Fix the missing closing brace in `src/lib/query-builder.ts` — until then `/dashboard/expenses` and
   `/dashboard/worth` will not compile, which is exactly where data gets entered. See `OVERVIEW.md` B1.
2. Register an account, create expense and asset categories (expenses require an existing category).
3. Enter real data and confirm the dashboard widgets populate.

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

Small stuff — cosmetic, dead code, papercuts. **Blocking build breaks and the security issue live in
`OVERVIEW.md` § 5** (B1–B3, B5); don't duplicate those here. IDs match `OVERVIEW.md` numbering.

| ID  | Bug                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------- |
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
