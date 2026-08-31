This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Running Docker

To start

```bash
docker compose up -d
```

To stop

```bash
docker compose down
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Sample thread for new agent prompts:
```
Before doing anything else, read these files in this repo, in this order:

1. INDEX.md      — read it in full. It is the map of this codebase and contains a
                   "Rules for agents" list at the top. Follow those rules for the
                   whole session.
2. CURRENT.md    — the task at hand, long term goals, known minor bugs.
3. OVERVIEW.md   — full project state, status by area, all known issues (B1, B2, …).
4. AGENTHISTORY.md — skim the last 2-3 entries only.

How to work in this repo:

- INDEX.md is your lookup table. Before grepping, globbing, or walking the tree for
  anything — a file's purpose, where a feature lives, the data model, conventions,
  commands, path aliases — check INDEX.md first. It exists specifically so agents
  stop re-deriving the same facts every session. Only fall back to searching the
  filesystem when INDEX.md genuinely doesn't cover what you need. Token efficiency
  is an explicit goal here, so don't re-read files INDEX.md already summarizes
  unless you're about to edit them.
- Do NOT assume we are working on any particular issue. The known bugs in
  CURRENT.md and OVERVIEW.md are documented, not assigned. Do not start fixing
  anything, refactoring, or "cleaning up" until I give you a task.
- Do not update any .md file yet. Per INDEX.md rule 4, docs get updated when I ask
  at the end of a work session — not as you go.
- The repo does not currently typecheck or build (see OVERVIEW.md § 5, B1-B3).
  Pre-existing errors are expected. Don't treat them as something you caused or
  something to fix unprompted.
- If a type error mentions @prisma/client having no exported members, that's the
  ungenerated client, not a source bug. See CURRENT.md § Gotchas.

When you're done reading, reply with a 3-4 line summary: what this project is, what
CURRENT.md says is active, and anything in the docs that looks stale or contradicts
what you actually see in the repo. Then stop and wait for my task.
```
