"use server";

import { redirect } from "next/navigation";
import {
  ContributionKind,
  ContributionLimitGroup,
  OccurrenceExceptionAction,
  PostingStatus,
  type ContributionLimitVariant,
  type Investment,
  type InvestmentContributionException,
  type Prisma,
} from "@prisma/client";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { QuerySerializer } from "@/lib/query-builder";
import { INVESTMENT_QUERY_FIELDS, type InvestmentQueryField } from "@/lib/query-fields";
import { addDaysUtc, todayUtc, toUtcDay } from "@/lib/dates";
import {
  expandOccurrences,
  OCCURRENCES_PER_MONTH,
  type Occurrence,
  type RecurrenceException,
  type RecurrenceRule,
} from "@/lib/recurrence";
import {
  balanceDirection,
  countsTowardPersonalLimit,
  LIMIT_GROUP_BY_ACCOUNT_TYPE,
  LIMIT_GROUP_LABELS,
  limitVariantFor,
  matchForContribution,
  matchPlanFor,
  writesExpense,
  type MatchPlan,
} from "@/lib/contribution-limits";
import { INVESTMENTS_PROJECTION_HORIZON_DAYS, LIMIT_WARNING_RATIO } from "@/constants";
import type { ActionResult } from "@/types/api";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  ContributionExceptionSchema,
  ContributionLimitSchema,
  NewInvestmentSchema,
  RecordBalanceSchema,
  RecordContributionSchema,
  RecordRolloverSchema,
  RecordWithdrawalSchema,
  UpdateContributionSchema,
  UpdateInvestmentSchema,
  type ContributionLimitView,
  type ContributionUsage,
  type ContributionView,
  type InvestmentSummary,
  type InvestmentView,
  type ProjectedContributionView,
} from "@/types/investment";

/**
 * How far back before the watermark each sweep re-scans, mirroring the earnings and debts
 * materialisers. An OVERRIDE can pull a contribution's effective date backwards into a window
 * already swept; re-scanning catches it, and the `[investmentId, scheduledDate]` unique
 * constraint makes the overlap free of side effects.
 */
const MATERIALIZE_LOOKBACK_DAYS = 62;

/** Guard on the per-account catch-up loop, matching the horizon the projector uses. */
const NEXT_CONTRIBUTION_LOOKAHEAD_DAYS = INVESTMENTS_PROJECTION_HORIZON_DAYS;

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

type InvestmentWithExceptions = Investment & { exceptions: InvestmentContributionException[] };

/** Cents, so repeated float addition cannot drift away from a Decimal(12,2) column. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * An account as the pure recurrence module sees it.
 *
 * Unlike a debt, the full frequency set is carried through — a 401k deferral lands per paycheck,
 * so BIWEEKLY and SEMI_MONTHLY matter here. The module is written around a gross/net pair for
 * earnings; a contribution has one figure, so both slots carry it.
 */
function toRecurrenceRule(investment: Investment): RecurrenceRule {
  const amount = investment.contributionAmount.toNumber();
  return {
    frequency: investment.frequency,
    anchorDate: investment.anchorDate,
    secondDayOfMonth: investment.secondDayOfMonth,
    endDate: investment.endDate,
    isActive: investment.isActive,
    grossAmount: amount,
    netAmount: amount,
  };
}

function toRecurrenceException(exception: InvestmentContributionException): RecurrenceException {
  const override = exception.overrideAmount?.toNumber() ?? null;
  return {
    scheduledDate: exception.scheduledDate,
    action: exception.action,
    overrideDate: exception.overrideDate,
    overrideGross: override,
    overrideNet: override,
  };
}

/**
 * Whether a contribution to this account writes an `Expense`.
 *
 * Having a bucket or a category is what says "this money leaves the checking account" — a Roth
 * funded from savings. A pre-tax 401k deferral has neither, never hits the account, and so is
 * not an expense at all.
 */
function isFundedFromAccount(investment: { bucketId: string | null; categoryId: string | null }): boolean {
  return investment.bucketId !== null || investment.categoryId !== null;
}

/** Session user id, or a redirect. Every exported action starts here. */
async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");
  return userId;
}

/** Rejects a bucket or category id that is not the caller's. Tenancy, not convenience. */
async function assertOwnedRefs(
  userId: string,
  bucketId: string | null | undefined,
  categoryId: string | null | undefined
): Promise<string | null> {
  if (bucketId) {
    const bucket = await dbClient.budgetBucket.findFirst({ where: { id: bucketId, userId }, select: { id: true } });
    if (!bucket) return "Budget bucket not found";
  }
  if (categoryId) {
    const category = await dbClient.expenseCategory.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!category) return "Expense category not found";
  }
  return null;
}

/**
 * Records the account's balance for one day.
 *
 * One row per account per day, so a second change on the same day overwrites the first and the
 * snapshot is that day's closing figure. This is the history the net-worth-over-time chart
 * reads; without it, growth arriving through the market rather than a contribution would leave
 * no trace.
 */
async function writeSnapshot(
  tx: Prisma.TransactionClient,
  investmentId: string,
  userId: string,
  date: Date,
  balance: Prisma.Decimal | number
): Promise<void> {
  const day = toUtcDay(date);
  await tx.investmentSnapshot.upsert({
    where: { investmentId_date: { investmentId, date: day } },
    create: { investmentId, userId, date: day, balance },
    update: { balance },
  });
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function createInvestment(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = NewInvestmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const refError = await assertOwnedRefs(userId, data.bucketId, data.categoryId);
  if (refError) return { ok: false, error: refError };

  try {
    const created = await dbClient.investment.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        accountType: data.accountType,
        institution: data.institution || null,
        balance: data.balance,
        contributionAmount: data.contributionAmount,
        frequency: data.frequency,
        anchorDate: toUtcDay(data.anchorDate),
        secondDayOfMonth: data.frequency === "SEMI_MONTHLY" ? (data.secondDayOfMonth ?? null) : null,
        endDate: data.endDate ? toUtcDay(data.endDate) : null,
        isActive: data.isActive ?? true,
        assumedReturnRate: data.assumedReturnRate ?? null,
        hsaCoverage: data.accountType === "HSA" ? (data.hsaCoverage ?? null) : null,
        employerMatchPercent: data.employerMatchPercent ?? null,
        employerMatchLimitPercent: data.employerMatchLimitPercent ?? null,
        annualSalary: data.annualSalary ?? null,
        bucketId: data.bucketId ?? null,
        categoryId: data.categoryId ?? null,
        userId,
      },
    });

    // The opening balance is history's first point, so the trend has somewhere to start.
    await writeSnapshot(dbClient, created.id, userId, todayUtc(), created.balance);
  } catch (error) {
    console.error(`Error creating investment: ${error}`);
    return { ok: false, error: "Could not create the account" };
  }
  return { ok: true };
}

/**
 * Edits an account. `balance` is editable here as well as through a balance correction — the
 * correction is the one that dates a snapshot, this is for fixing a typo in the figure.
 */
export async function updateInvestment(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = UpdateInvestmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const refError = await assertOwnedRefs(userId, data.bucketId, data.categoryId);
  if (refError) return { ok: false, error: refError };

  try {
    const updated = await dbClient.investment.updateMany({
      where: { id: data.id, userId },
      data: {
        title: data.title,
        description: data.description ?? null,
        accountType: data.accountType,
        institution: data.institution || null,
        balance: data.balance,
        contributionAmount: data.contributionAmount,
        frequency: data.frequency,
        anchorDate: toUtcDay(data.anchorDate),
        secondDayOfMonth: data.frequency === "SEMI_MONTHLY" ? (data.secondDayOfMonth ?? null) : null,
        endDate: data.endDate ? toUtcDay(data.endDate) : null,
        assumedReturnRate: data.assumedReturnRate ?? null,
        hsaCoverage: data.accountType === "HSA" ? (data.hsaCoverage ?? null) : null,
        employerMatchPercent: data.employerMatchPercent ?? null,
        employerMatchLimitPercent: data.employerMatchLimitPercent ?? null,
        annualSalary: data.annualSalary ?? null,
        bucketId: data.bucketId ?? null,
        categoryId: data.categoryId ?? null,
        ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      },
    });
    if (!updated.count) return { ok: false, error: "Account not found" };

    // Keep today's snapshot in step with an edited balance rather than leaving history claiming
    // a figure the account no longer has.
    await writeSnapshot(dbClient, data.id, userId, todayUtc(), data.balance);
  } catch (error) {
    console.error(`Error updating investment: ${error}`);
    return { ok: false, error: "Could not update the account" };
  }
  return { ok: true };
}

/** Pause or resume an account. A paused account posts nothing; its balance still counts. */
export async function setInvestmentActive(id: string, isActive: boolean): Promise<ActionResult> {
  const userId = await requireUserId();

  const updated = await dbClient.investment.updateMany({ where: { id, userId }, data: { isActive } });
  if (!updated.count) return { ok: false, error: "Account not found" };
  return { ok: true };
}

/**
 * Removes an account. Contributions it already posted survive with `investmentId` null (the FK
 * is `onDelete: SetNull`) and the expenses they generated are untouched — money that left the
 * account still left it. Snapshots and exceptions cascade away with the account they described.
 */
export async function deleteInvestment(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const deleted = await dbClient.investment.deleteMany({ where: { id, userId } });
  if (!deleted.count) return { ok: false, error: "Account not found" };
  return { ok: true };
}

/**
 * Every account with its next scheduled contribution.
 *
 * The next contribution is expanded from the same pure module the projector and materialiser
 * use, so the date on the card is the date that will actually post.
 */
export async function getInvestments(): Promise<InvestmentView[]> {
  const userId = await requireUserId();

  const today = todayUtc();
  const investments = await dbClient.investment.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }],
    include: {
      exceptions: true,
      bucket: { select: { title: true } },
      category: { select: { title: true } },
      snapshots: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });
  if (!investments.length) return [];

  // A slot that already materialised is not "next" — it has been posted.
  const posted = await dbClient.investmentContribution.findMany({
    where: { userId, scheduledDate: { not: null } },
    select: { investmentId: true, scheduledDate: true },
  });
  const taken = new Set(posted.map((row) => `${row.investmentId}:${row.scheduledDate?.toISOString()}`));

  // Year-to-date money in, split by whose it was. Cancelled rows are excluded — they moved
  // nothing — and withdrawals are ignored here because taking money out does not give back
  // contribution room.
  const { start: yearStart, end: yearEnd } = yearBounds(today);
  const yearToDate = await dbClient.investmentContribution.groupBy({
    by: ["investmentId", "kind"],
    where: {
      userId,
      status: { not: PostingStatus.CANCELLED },
      date: { gte: yearStart, lte: yearEnd },
    },
    _sum: { amount: true },
  });
  const ytdByAccount = new Map<string, { employee: number; employer: number }>();
  for (const row of yearToDate) {
    if (!row.investmentId) continue;
    const entry = ytdByAccount.get(row.investmentId) ?? { employee: 0, employer: 0 };
    const amount = Number(row._sum.amount ?? 0);
    if (row.kind === ContributionKind.EMPLOYEE) entry.employee += amount;
    if (row.kind === ContributionKind.EMPLOYER_MATCH) entry.employer += amount;
    ytdByAccount.set(row.investmentId, entry);
  }

  return investments.map((investment) => {
    const contributionAmount = investment.contributionAmount.toNumber();

    let nextContributionDate: Date | null = null;
    let nextContributionAmount: number | null = null;

    if (investment.isActive && contributionAmount > 0) {
      const upcoming = expandOccurrences(
        toRecurrenceRule(investment),
        investment.exceptions.map(toRecurrenceException),
        today,
        addDaysUtc(today, NEXT_CONTRIBUTION_LOOKAHEAD_DAYS)
      ).find(
        (occurrence) => !occurrence.skipped && !taken.has(`${investment.id}:${occurrence.scheduledDate.toISOString()}`)
      );

      if (upcoming) {
        nextContributionDate = upcoming.date;
        nextContributionAmount = roundCents(upcoming.netAmount);
      }
    }

    const ytd = ytdByAccount.get(investment.id) ?? { employee: 0, employer: 0 };
    const plan = matchPlanForInvestment(investment);
    // What this year's schedule will add on top of what has already gone in. Falling short of
    // the threshold means leaving employer money unclaimed, which is worth saying out loud.
    const remainingScheduled =
      contributionAmount * OCCURRENCES_PER_MONTH[investment.frequency] * monthsLeftInYear(today);
    const projectedAnnualEmployee = ytd.employee + (investment.isActive ? remainingScheduled : 0);

    return {
      id: investment.id,
      title: investment.title,
      description: investment.description,
      accountType: investment.accountType,
      institution: investment.institution,
      balance: investment.balance.toNumber(),
      contributionAmount,
      frequency: investment.frequency,
      anchorDate: investment.anchorDate,
      secondDayOfMonth: investment.secondDayOfMonth,
      endDate: investment.endDate,
      isActive: investment.isActive,
      bucketId: investment.bucketId,
      bucketTitle: investment.bucket?.title ?? null,
      categoryId: investment.categoryId,
      categoryTitle: investment.category?.title ?? null,
      nextContributionDate,
      nextContributionAmount,
      fundedFromAccount: isFundedFromAccount(investment),
      lastSnapshotDate: investment.snapshots[0]?.date ?? null,
      assumedReturnRate: investment.assumedReturnRate?.toNumber() ?? null,
      hsaCoverage: investment.hsaCoverage,
      employerMatchPercent: investment.employerMatchPercent?.toNumber() ?? null,
      employerMatchLimitPercent: investment.employerMatchLimitPercent?.toNumber() ?? null,
      annualSalary: investment.annualSalary?.toNumber() ?? null,
      limitGroup: LIMIT_GROUP_BY_ACCOUNT_TYPE[investment.accountType],
      maxAnnualMatch: plan.configured ? plan.maxAnnualMatch : null,
      contributionForFullMatch: plan.configured ? plan.employeeContributionForFullMatch : null,
      employeeContributedThisYear: roundCents(ytd.employee),
      employerContributedThisYear: roundCents(ytd.employer),
      belowMatchThreshold: plan.configured
        ? roundCents(projectedAnnualEmployee) < plan.employeeContributionForFullMatch
        : null,
    };
  });
}

/** Whole months left in `date`'s year, counting the one it is in. December is 1, January is 12. */
function monthsLeftInYear(date: Date): number {
  return 12 - date.getUTCMonth();
}

/** Totals for the page header, and the balance net worth adds. */
export async function getInvestmentSummary(): Promise<InvestmentSummary> {
  const userId = await requireUserId();

  const investments = await dbClient.investment.findMany({
    where: { userId },
    select: { balance: true, contributionAmount: true, frequency: true, isActive: true, accountType: true },
  });

  let totalBalance = 0;
  let monthlyContribution = 0;
  const balanceByType = new Map<string, number>();

  for (const investment of investments) {
    const balance = investment.balance.toNumber();
    totalBalance += balance;
    balanceByType.set(investment.accountType, (balanceByType.get(investment.accountType) ?? 0) + balance);
    if (investment.isActive) {
      monthlyContribution += investment.contributionAmount.toNumber() * OCCURRENCES_PER_MONTH[investment.frequency];
    }
  }

  return {
    totalBalance: roundCents(totalBalance),
    monthlyContribution: roundCents(monthlyContribution),
    accountCount: investments.length,
    byType: ACCOUNT_TYPE_ORDER.filter((type) => balanceByType.has(type)).map((type) => ({
      accountType: type,
      label: ACCOUNT_TYPE_LABELS[type],
      balance: roundCents(balanceByType.get(type) ?? 0),
    })),
  };
}

// ---------------------------------------------------------------------------
// Posting — the "auto-post" half of auto-post-then-verify
// ---------------------------------------------------------------------------

/**
 * Writes one contribution: the row, the balance increment, that day's snapshot, and — only when
 * the account is funded from the checking account — an `Expense`.
 *
 * All of it in one transaction, because it is one event. The expense carries the account's
 * `bucketId`, which is the whole of the budget wiring: bucket spend is derived by summing
 * expenses, so a contribution lands in its bucket with no second mechanism to drift.
 *
 * Unlike a debt payment there is no cap — nothing bounds how much can go into an account, and
 * contribution limits are explicitly out of scope for this phase.
 */
async function postContribution(
  tx: Prisma.TransactionClient,
  investment: Investment,
  requestedAmount: number,
  date: Date,
  scheduledDate: Date | null,
  status: PostingStatus,
  kind: ContributionKind = ContributionKind.EMPLOYEE,
  sourceContributionId: string | null = null
): Promise<{ amount: number; id: string } | null> {
  const amount = roundCents(requestedAmount);
  if (amount <= 0) return null;

  // Only your own money leaving your account is spending. Employer match never touches the
  // account, a rollover moves money you already had, and a withdrawal comes back to you.
  let expenseId: string | null = null;
  if (writesExpense(kind) && isFundedFromAccount(investment)) {
    const expense = await tx.expense.create({
      data: {
        title: investment.title,
        description: `Investment contribution — ${investment.title}`.slice(0, 256),
        amount,
        userId: investment.userId,
        categoryId: investment.categoryId,
        bucketId: investment.bucketId,
        date,
      },
    });
    expenseId = expense.id;
  }

  const contribution = await tx.investmentContribution.create({
    data: {
      amount,
      kind,
      date,
      scheduledDate,
      status,
      confirmedAt: status === PostingStatus.CONFIRMED ? new Date() : null,
      investmentId: investment.id,
      expenseId,
      sourceContributionId,
      userId: investment.userId,
    },
  });

  const updated = await tx.investment.update({
    where: { id: investment.id },
    data: { balance: { increment: amount * balanceDirection(kind) } },
  });

  await writeSnapshot(tx, investment.id, investment.userId, date, updated.balance);

  return { amount, id: contribution.id };
}

/** The calendar year bounds of `date`, as UTC days — the window every annual figure uses. */
function yearBounds(date: Date): { start: Date; end: Date } {
  const year = date.getUTCFullYear();
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)) };
}

/** Employer match already paid into one account in the calendar year containing `date`. */
async function matchPaidInYear(tx: Prisma.TransactionClient, investmentId: string, date: Date): Promise<number> {
  const { start, end } = yearBounds(date);
  const paid = await tx.investmentContribution.aggregate({
    where: {
      investmentId,
      kind: ContributionKind.EMPLOYER_MATCH,
      status: { not: PostingStatus.CANCELLED },
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return Number(paid._sum.amount ?? 0);
}

function matchPlanForInvestment(investment: Investment): MatchPlan {
  return matchPlanFor({
    matchPercent: investment.employerMatchPercent?.toNumber() ?? null,
    matchLimitPercent: investment.employerMatchLimitPercent?.toNumber() ?? null,
    annualSalary: investment.annualSalary?.toNumber() ?? null,
  });
}

/**
 * Posts the employer match earned by one employee contribution, if the account has a match.
 *
 * Capped at what is left of the year's match, which is what makes front-loading behave the way
 * a real plan does: once the employer has paid its maximum for the year, later contributions
 * earn nothing more. The match row is linked back to the contribution that earned it, so
 * cancelling or deleting that contribution takes the match with it.
 */
async function postMatchFor(
  tx: Prisma.TransactionClient,
  investment: Investment,
  employeeAmount: number,
  date: Date,
  status: PostingStatus,
  sourceContributionId: string
): Promise<void> {
  const plan = matchPlanForInvestment(investment);
  if (!plan.configured) return;

  const alreadyMatched = await matchPaidInYear(tx, investment.id, date);
  const match = matchForContribution(plan, employeeAmount, alreadyMatched);
  if (match <= 0) return;

  // Re-read: the employee contribution has already moved the balance in this transaction.
  const current = await tx.investment.findUniqueOrThrow({ where: { id: investment.id } });
  await postContribution(tx, current, match, date, null, status, ContributionKind.EMPLOYER_MATCH, sourceContributionId);
}

/** Prisma's unique-constraint violation — here, a slot another sweep already posted. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Posts every contribution whose date has passed and that is not already posted, leaving each at
 * `PROJECTED` for the user to confirm or cancel.
 *
 * Idempotent by construction: the `[investmentId, scheduledDate]` unique constraint means running
 * this twice cannot double-post, and a collision rolls back that contribution's whole transaction
 * — no orphan expense, no double increment. Called on load of the investments page; the
 * launch-time catch-up checker will call this same function rather than add a second code path.
 */
export async function materializeDueContributions(): Promise<ActionResult> {
  const userId = await requireUserId();

  const today = todayUtc();
  const investments = await dbClient.investment.findMany({
    where: { userId, isActive: true },
    include: { exceptions: true },
  });

  try {
    for (const investment of investments as InvestmentWithExceptions[]) {
      if (investment.contributionAmount.toNumber() > 0) {
        const from = investment.lastMaterializedThrough
          ? addDaysUtc(investment.lastMaterializedThrough, -MATERIALIZE_LOOKBACK_DAYS)
          : investment.anchorDate;

        const due = expandOccurrences(
          toRecurrenceRule(investment),
          investment.exceptions.map(toRecurrenceException),
          from,
          today
        ).filter((occurrence) => !occurrence.skipped);

        for (const occurrence of due) {
          const existing = await dbClient.investmentContribution.findFirst({
            where: { investmentId: investment.id, scheduledDate: occurrence.scheduledDate },
            select: { id: true },
          });
          if (existing) continue;

          try {
            await dbClient.$transaction(async (tx) => {
              const posted = await postContribution(
                tx,
                investment,
                occurrence.netAmount,
                occurrence.date,
                occurrence.scheduledDate,
                PostingStatus.PROJECTED
              );
              // Employer money rides along with the contribution that earned it, in the same
              // transaction — a match without its contribution would be money from nowhere.
              if (posted) {
                await postMatchFor(tx, investment, posted.amount, occurrence.date, PostingStatus.PROJECTED, posted.id);
              }
            });
          } catch (error) {
            // Another sweep won the race for this slot; it is posted either way.
            if (!isUniqueViolation(error)) throw error;
          }
        }
      }

      await dbClient.investment.update({
        where: { id: investment.id },
        data: { lastMaterializedThrough: today },
      });
    }
  } catch (error) {
    console.error(`Error materializing contributions: ${error}`);
    return { ok: false, error: "Could not post due contributions" };
  }
  return { ok: true };
}

/**
 * Records a contribution made outside the schedule — a lump sum, or a catch-up.
 *
 * It has no `scheduledDate`, so it fills no slot and the schedule still posts as normal.
 */
export async function recordContribution(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = RecordContributionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const investment = await dbClient.investment.findFirst({ where: { id: data.investmentId, userId } });
  if (!investment) return { ok: false, error: "Account not found" };

  try {
    // Recorded by hand, so it is CONFIRMED on arrival — there is nothing to verify later.
    const posted = await dbClient.$transaction(async (tx) => {
      const contribution = await postContribution(
        tx,
        investment,
        data.amount,
        toUtcDay(data.date),
        null,
        PostingStatus.CONFIRMED
      );
      if (contribution) {
        await postMatchFor(
          tx,
          investment,
          contribution.amount,
          toUtcDay(data.date),
          PostingStatus.CONFIRMED,
          contribution.id
        );
      }
      return contribution;
    });
    if (!posted) return { ok: false, error: "A contribution must be more than zero" };
  } catch (error) {
    console.error(`Error recording contribution: ${error}`);
    return { ok: false, error: "Could not record the contribution" };
  }
  return { ok: true };
}

/**
 * Corrects an account's balance and dates the correction.
 *
 * This is how market growth, interest and fees get in: none of them flow through a contribution,
 * so without this the balance would only ever be the sum of what was paid in.
 *
 * A back-dated correction fills in history without touching the current balance — entering last
 * January's statement should not claim the account is worth that today. Only a correction dated
 * on or after the newest snapshot moves `Investment.balance`.
 */
export async function recordInvestmentBalance(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = RecordBalanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const investment = await dbClient.investment.findFirst({
    where: { id: data.investmentId, userId },
    select: { id: true },
  });
  if (!investment) return { ok: false, error: "Account not found" };

  const date = toUtcDay(data.date);
  const latest = await dbClient.investmentSnapshot.findFirst({
    where: { investmentId: investment.id },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const isCurrent = !latest || date >= latest.date;

  try {
    await dbClient.$transaction(async (tx) => {
      await writeSnapshot(tx, investment.id, userId, date, data.balance);
      if (isCurrent) {
        await tx.investment.update({ where: { id: investment.id }, data: { balance: data.balance } });
      }
    });
  } catch (error) {
    console.error(`Error recording investment balance: ${error}`);
    return { ok: false, error: "Could not record the balance" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contributions (materialised rows)
// ---------------------------------------------------------------------------

export async function getContributions(): Promise<ContributionView[]> {
  const userId = await requireUserId();

  const contributions = await dbClient.investmentContribution.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { investment: { select: { title: true } } },
  });

  return contributions.map((contribution) => ({
    id: contribution.id,
    amount: contribution.amount.toNumber(),
    kind: contribution.kind,
    date: contribution.date,
    scheduledDate: contribution.scheduledDate,
    status: contribution.status,
    investmentId: contribution.investmentId,
    investmentTitle: contribution.investment?.title ?? null,
    expenseId: contribution.expenseId,
  }));
}

/** Auto-posted contributions still awaiting the user's confirm/cancel. */
export async function getPendingContributions(): Promise<ContributionView[]> {
  const contributions = await getContributions();
  return contributions.filter((contribution) => contribution.status === PostingStatus.PROJECTED);
}

/**
 * Marks an auto-posted contribution as really made. The balance and the expense moved when it
 * posted, so confirming changes nothing but the status.
 */
export async function confirmContribution(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const updated = await dbClient.investmentContribution.updateMany({
    where: { id, userId, status: PostingStatus.PROJECTED },
    data: { status: PostingStatus.CONFIRMED, confirmedAt: new Date() },
  });
  if (!updated.count) return { ok: false, error: "Contribution not found" };
  return { ok: true };
}

/**
 * Marks an auto-posted contribution as never made, and undoes everything posting it did: the
 * balance comes back down and any generated expense is deleted, because the money never moved.
 *
 * The correction is snapshotted under **today**, not the contribution's own date — a snapshot is
 * what was believed on the day it was written, and rewriting a past day would silently restate
 * history the chart has already shown.
 *
 * The row itself is kept as CANCELLED for audit, and keeping it is also what stops the next sweep
 * re-posting the same slot.
 */
export async function cancelContribution(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const contribution = await dbClient.investmentContribution.findFirst({
    where: { id, userId },
    include: { matchContribution: true },
  });
  if (!contribution) return { ok: false, error: "Contribution not found" };
  if (contribution.status === PostingStatus.CANCELLED) return { ok: true };

  try {
    await dbClient.$transaction(async (tx) => {
      // Reverse the match first: a match that was never earned must not survive the contribution
      // that earned it.
      const match = contribution.matchContribution;
      if (match && match.status !== PostingStatus.CANCELLED && match.investmentId) {
        await tx.investment.update({
          where: { id: match.investmentId },
          data: { balance: { decrement: match.amount.toNumber() * balanceDirection(match.kind) } },
        });
        await tx.investmentContribution.update({
          where: { id: match.id },
          data: { status: PostingStatus.CANCELLED, confirmedAt: null },
        });
      }

      if (contribution.investmentId) {
        const updated = await tx.investment.update({
          where: { id: contribution.investmentId },
          data: { balance: { decrement: contribution.amount.toNumber() * balanceDirection(contribution.kind) } },
        });
        await writeSnapshot(tx, contribution.investmentId, userId, todayUtc(), updated.balance);
      }
      if (contribution.expenseId) {
        await tx.expense.deleteMany({ where: { id: contribution.expenseId, userId } });
      }
      await tx.investmentContribution.update({
        where: { id: contribution.id },
        data: { status: PostingStatus.CANCELLED, confirmedAt: null, expenseId: null },
      });
    });
  } catch (error) {
    console.error(`Error cancelling contribution: ${error}`);
    return { ok: false, error: "Could not cancel the contribution" };
  }
  return { ok: true };
}

export async function confirmAllPendingContributions(): Promise<ActionResult> {
  const userId = await requireUserId();

  await dbClient.investmentContribution.updateMany({
    where: { userId, status: PostingStatus.PROJECTED },
    data: { status: PostingStatus.CONFIRMED, confirmedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Deletes a contribution outright.
 *
 * Unless it was already cancelled, this reverses its effects first — balance back down, generated
 * expense removed. If it came from the schedule, a SKIP exception is recorded for its slot in the
 * same transaction; otherwise the next sweep would helpfully recreate the row just deleted.
 * Deleting therefore means "this one never happened", permanently.
 */
export async function deleteContribution(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const contribution = await dbClient.investmentContribution.findFirst({
    where: { id, userId },
    include: { matchContribution: true },
  });
  if (!contribution) return { ok: false, error: "Contribution not found" };

  const alreadyReversed = contribution.status === PostingStatus.CANCELLED;

  try {
    await dbClient.$transaction(async (tx) => {
      // The match row is removed by the FK cascade, so its effect on the balance has to be
      // undone here first or it would vanish leaving the money behind.
      const match = contribution.matchContribution;
      if (match && match.status !== PostingStatus.CANCELLED && match.investmentId) {
        await tx.investment.update({
          where: { id: match.investmentId },
          data: { balance: { decrement: match.amount.toNumber() * balanceDirection(match.kind) } },
        });
      }

      if (!alreadyReversed && contribution.investmentId) {
        const updated = await tx.investment.update({
          where: { id: contribution.investmentId },
          data: { balance: { decrement: contribution.amount.toNumber() * balanceDirection(contribution.kind) } },
        });
        await writeSnapshot(tx, contribution.investmentId, userId, todayUtc(), updated.balance);
      }
      if (!alreadyReversed && contribution.expenseId) {
        await tx.expense.deleteMany({ where: { id: contribution.expenseId, userId } });
      }

      await tx.investmentContribution.delete({ where: { id: contribution.id } });

      if (contribution.investmentId && contribution.scheduledDate) {
        await tx.investmentContributionException.upsert({
          where: {
            investmentId_scheduledDate: {
              investmentId: contribution.investmentId,
              scheduledDate: contribution.scheduledDate,
            },
          },
          create: {
            investmentId: contribution.investmentId,
            scheduledDate: contribution.scheduledDate,
            action: OccurrenceExceptionAction.SKIP,
            userId,
          },
          update: { action: OccurrenceExceptionAction.SKIP, overrideDate: null, overrideAmount: null },
        });
      }
    });
  } catch (error) {
    console.error(`Error deleting contribution: ${error}`);
    return { ok: false, error: "Could not delete the contribution" };
  }
  return { ok: true };
}

/**
 * Corrects a posted contribution's amount or date — the manual override for a figure that has
 * already moved money.
 *
 * Everything the original posting touched is reconciled by the difference: the account balance,
 * the linked expense, and that day's snapshot. Deliberately allowed on CONFIRMED rows, because
 * the case this exists for is finding out afterwards that the real figure was different.
 *
 * The employer match is **not** recomputed. A corrected contribution does not retroactively
 * change what an employer actually paid; if the match needs correcting too, correct it directly.
 */
export async function updateContribution(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = UpdateContributionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const contribution = await dbClient.investmentContribution.findFirst({ where: { id: data.id, userId } });
  if (!contribution) return { ok: false, error: "Contribution not found" };
  if (contribution.status === PostingStatus.CANCELLED) {
    return { ok: false, error: "This contribution was cancelled — it moved no money to correct" };
  }

  const newAmount = roundCents(data.amount);
  const date = toUtcDay(data.date);
  const delta = roundCents(newAmount - contribution.amount.toNumber()) * balanceDirection(contribution.kind);

  try {
    await dbClient.$transaction(async (tx) => {
      await tx.investmentContribution.update({
        where: { id: contribution.id },
        data: { amount: newAmount, date },
      });

      if (contribution.expenseId) {
        await tx.expense.updateMany({
          where: { id: contribution.expenseId, userId },
          data: { amount: newAmount, date },
        });
      }

      if (contribution.investmentId && delta !== 0) {
        const updated = await tx.investment.update({
          where: { id: contribution.investmentId },
          data: { balance: { increment: delta } },
        });
        await writeSnapshot(tx, contribution.investmentId, userId, todayUtc(), updated.balance);
      }
    });
  } catch (error) {
    console.error(`Error updating contribution: ${error}`);
    return { ok: false, error: "Could not update the contribution" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Projection + exceptions
// ---------------------------------------------------------------------------

/**
 * Future contributions, computed on every request and never written.
 *
 * `balanceAfter` runs against a copy of the balance so the schedule shows where each account is
 * heading. It is contributions only — no rate of return is applied, deliberately: assumed growth
 * rates are a Long term goal, and quietly compounding one here would make a projection look like
 * a forecast.
 */
export async function getProjectedContributions(horizonDays?: number): Promise<ProjectedContributionView[]> {
  const userId = await requireUserId();

  const today = todayUtc();
  const horizonEnd = addDaysUtc(today, horizonDays ?? INVESTMENTS_PROJECTION_HORIZON_DAYS);

  const investments = await dbClient.investment.findMany({
    where: { userId, isActive: true },
    include: { exceptions: true },
  });
  if (!investments.length) return [];

  // A future-dated override can land on a slot that already materialised; never show both.
  const posted = await dbClient.investmentContribution.findMany({
    where: { userId, scheduledDate: { not: null } },
    select: { investmentId: true, scheduledDate: true },
  });
  const taken = new Set(posted.map((row) => `${row.investmentId}:${row.scheduledDate?.toISOString()}`));

  const projected: ProjectedContributionView[] = [];

  for (const investment of investments as InvestmentWithExceptions[]) {
    if (investment.contributionAmount.toNumber() <= 0) continue;
    let runningBalance = investment.balance.toNumber();

    const occurrences: Occurrence[] = expandOccurrences(
      toRecurrenceRule(investment),
      investment.exceptions.map(toRecurrenceException),
      addDaysUtc(today, 1),
      horizonEnd
    );

    for (const occurrence of occurrences) {
      if (taken.has(`${investment.id}:${occurrence.scheduledDate.toISOString()}`)) continue;

      // A skipped slot is still listed so it can be un-skipped, but it moves no money.
      if (!occurrence.skipped) runningBalance = roundCents(runningBalance + occurrence.netAmount);

      projected.push({
        investmentId: investment.id,
        investmentTitle: investment.title,
        scheduledDate: occurrence.scheduledDate,
        date: occurrence.date,
        amount: roundCents(occurrence.netAmount),
        balanceAfter: runningBalance,
        skipped: occurrence.skipped,
        overridden: occurrence.overridden,
      });
    }
  }

  return projected.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Skips or overrides one future contribution. One row per slot; the account is untouched. */
export async function setContributionException(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = ContributionExceptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const investment = await dbClient.investment.findFirst({
    where: { id: data.investmentId, userId },
    select: { id: true },
  });
  if (!investment) return { ok: false, error: "Account not found" };

  const scheduledDate = toUtcDay(data.scheduledDate);
  const fields = {
    action: data.action,
    overrideDate: data.overrideDate ? toUtcDay(data.overrideDate) : null,
    overrideAmount: data.overrideAmount ?? null,
  };

  try {
    await dbClient.investmentContributionException.upsert({
      where: { investmentId_scheduledDate: { investmentId: investment.id, scheduledDate } },
      create: { investmentId: investment.id, scheduledDate, userId, ...fields },
      update: fields,
    });
  } catch (error) {
    console.error(`Error saving contribution exception: ${error}`);
    return { ok: false, error: "Could not save the change" };
  }
  return { ok: true };
}

/** Restores a contribution to whatever the schedule says. */
export async function clearContributionException(investmentId: string, scheduledDate: Date): Promise<ActionResult> {
  const userId = await requireUserId();

  await dbClient.investmentContributionException.deleteMany({
    where: { investmentId, scheduledDate: toUtcDay(scheduledDate), userId },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Withdrawals and rollovers
// ---------------------------------------------------------------------------

/**
 * Takes money out of an account.
 *
 * Recorded as a contribution row of kind WITHDRAWAL so that one table remains the whole story of
 * an account's movements. It lowers the balance and writes no expense — money coming back to you
 * is not spending.
 *
 * It does **not** restore contribution room: taking $1,000 out in June does not let you put
 * $1,000 more in come December, and `countsTowardPersonalLimit` is what enforces that.
 */
export async function recordWithdrawal(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = RecordWithdrawalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const investment = await dbClient.investment.findFirst({ where: { id: data.investmentId, userId } });
  if (!investment) return { ok: false, error: "Account not found" };
  if (investment.balance.toNumber() < data.amount) {
    return { ok: false, error: "That is more than the account holds" };
  }

  try {
    const posted = await dbClient.$transaction((tx) =>
      postContribution(
        tx,
        investment,
        data.amount,
        toUtcDay(data.date),
        null,
        PostingStatus.CONFIRMED,
        ContributionKind.WITHDRAWAL
      )
    );
    if (!posted) return { ok: false, error: "A withdrawal must be more than zero" };
  } catch (error) {
    console.error(`Error recording withdrawal: ${error}`);
    return { ok: false, error: "Could not record the withdrawal" };
  }
  return { ok: true };
}

/**
 * Records money rolled in from another account — an old 401(k) moved to an IRA, say.
 *
 * It raises the balance but counts against no limit, because it is money you already had rather
 * than new money going in. Treating a rollover as a contribution is a common way to look
 * over-contributed when you are not.
 */
export async function recordRollover(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = RecordRolloverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const investment = await dbClient.investment.findFirst({ where: { id: data.investmentId, userId } });
  if (!investment) return { ok: false, error: "Account not found" };

  try {
    const posted = await dbClient.$transaction((tx) =>
      postContribution(
        tx,
        investment,
        data.amount,
        toUtcDay(data.date),
        null,
        PostingStatus.CONFIRMED,
        ContributionKind.ROLLOVER
      )
    );
    if (!posted) return { ok: false, error: "A rollover must be more than zero" };
  } catch (error) {
    console.error(`Error recording rollover: ${error}`);
    return { ok: false, error: "Could not record the rollover" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contribution limits
// ---------------------------------------------------------------------------

/**
 * Creates or updates one year's cap for one group.
 *
 * An upsert on [year, group, variant] rather than separate create/update actions: there is only
 * ever one cap for a given year and group, so re-entering it should correct it rather than fail.
 * The figures are the owner's to enter — nothing here supplies a default, because an IRS number
 * baked into the source goes stale within a year and would be believed anyway.
 */
export async function saveContributionLimit(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = ContributionLimitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  if (data.group === ContributionLimitGroup.NONE) {
    return { ok: false, error: "Savings and other accounts have no annual limit" };
  }

  const variant = (data.variant ?? "STANDARD") as ContributionLimitVariant;
  const fields = {
    limit: data.limit,
    totalAdditionsLimit: data.totalAdditionsLimit ?? null,
    contributedAdjustment: data.contributedAdjustment ?? 0,
  };

  try {
    await dbClient.contributionLimit.upsert({
      where: {
        userId_year_group_variant: { userId, year: data.year, group: data.group, variant },
      },
      create: { userId, year: data.year, group: data.group, variant, ...fields },
      update: fields,
    });
  } catch (error) {
    console.error(`Error saving contribution limit: ${error}`);
    return { ok: false, error: "Could not save the limit" };
  }
  return { ok: true };
}

export async function deleteContributionLimit(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const deleted = await dbClient.contributionLimit.deleteMany({ where: { id, userId } });
  if (!deleted.count) return { ok: false, error: "Limit not found" };
  return { ok: true };
}

export async function getContributionLimits(year?: number): Promise<ContributionLimitView[]> {
  const userId = await requireUserId();

  const limits = await dbClient.contributionLimit.findMany({
    where: { userId, ...(year === undefined ? {} : { year }) },
    orderBy: [{ year: "desc" }, { group: "asc" }, { variant: "asc" }],
  });

  return limits.map((limit) => ({
    id: limit.id,
    year: limit.year,
    group: limit.group,
    variant: limit.variant,
    limit: limit.limit.toNumber(),
    totalAdditionsLimit: limit.totalAdditionsLimit?.toNumber() ?? null,
    contributedAdjustment: limit.contributedAdjustment.toNumber(),
  }));
}

/**
 * How much of each group's annual room has been used.
 *
 * Grouped, not per account, because that is how the caps actually work — a Roth IRA and a
 * Traditional IRA draw on one shared limit, so reporting them separately would show twice the
 * room that exists.
 *
 * Only EMPLOYEE money counts. Employer match is reported beside it against its own combined cap,
 * rollovers are shown for reconciliation only, and withdrawals are ignored: taking money out
 * does not return contribution room.
 *
 * A group with no limit row for the year reports `status: "unknown"` and a null limit. That is
 * deliberate — no figure is invented, and the UI says "no limit set" rather than implying room.
 */
export async function getContributionUsage(year?: number): Promise<ContributionUsage[]> {
  const userId = await requireUserId();

  const targetYear = year ?? todayUtc().getUTCFullYear();
  const start = new Date(Date.UTC(targetYear, 0, 1));
  const end = new Date(Date.UTC(targetYear, 11, 31));

  const [investments, contributions, limits] = await Promise.all([
    dbClient.investment.findMany({ where: { userId }, select: { id: true, accountType: true, hsaCoverage: true } }),
    dbClient.investmentContribution.groupBy({
      by: ["investmentId", "kind"],
      where: { userId, status: { not: PostingStatus.CANCELLED }, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    dbClient.contributionLimit.findMany({ where: { userId, year: targetYear } }),
  ]);

  type Bucket = { employee: number; employer: number; rollovers: number; variant: ContributionLimitVariant };
  const byGroup = new Map<ContributionLimitGroup, Bucket>();

  for (const investment of investments) {
    const group = LIMIT_GROUP_BY_ACCOUNT_TYPE[investment.accountType];
    if (group === ContributionLimitGroup.NONE) continue;
    const variant = limitVariantFor(group, investment.hsaCoverage);
    const bucket = byGroup.get(group) ?? { employee: 0, employer: 0, rollovers: 0, variant };
    // An HSA switched to family coverage mid-year draws on the family limit for the whole year.
    if (variant === "HSA_FAMILY") bucket.variant = variant;
    byGroup.set(group, bucket);
  }

  const groupByAccount = new Map(
    investments.map((investment) => [investment.id, LIMIT_GROUP_BY_ACCOUNT_TYPE[investment.accountType]])
  );

  for (const row of contributions) {
    if (!row.investmentId) continue;
    const group = groupByAccount.get(row.investmentId);
    if (!group || group === ContributionLimitGroup.NONE) continue;
    const bucket = byGroup.get(group);
    if (!bucket) continue;

    const amount = Number(row._sum.amount ?? 0);
    if (row.kind === ContributionKind.EMPLOYER_MATCH) bucket.employer += amount;
    else if (row.kind === ContributionKind.ROLLOVER) bucket.rollovers += amount;
    else if (countsTowardPersonalLimit(row.kind)) bucket.employee += amount;
  }

  const usage: ContributionUsage[] = [];
  for (const [group, bucket] of byGroup) {
    const limitRow = limits.find((row) => row.group === group && row.variant === bucket.variant);
    const adjustment = limitRow?.contributedAdjustment.toNumber() ?? 0;
    const contributed = roundCents(bucket.employee + adjustment);
    const limit = limitRow?.limit.toNumber() ?? null;
    const totalAdditionsLimit = limitRow?.totalAdditionsLimit?.toNumber() ?? null;

    usage.push({
      group,
      variant: bucket.variant,
      label: LIMIT_GROUP_LABELS[group],
      year: targetYear,
      limit,
      totalAdditionsLimit,
      contributed,
      employerContributed: roundCents(bucket.employer),
      rollovers: roundCents(bucket.rollovers),
      adjustment,
      remaining: limit === null ? null : roundCents(limit - contributed),
      status:
        limit === null
          ? "unknown"
          : contributed > limit
            ? "over"
            : contributed >= limit * LIMIT_WARNING_RATIO
              ? "warning"
              : "ok",
      overTotalAdditions:
        totalAdditionsLimit !== null && roundCents(contributed + bucket.employer) > totalAdditionsLimit,
    });
  }

  return usage.sort((a, b) => a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------------------
// Generic query API
// ---------------------------------------------------------------------------

export async function investmentApi(query: unknown) {
  const userId = await requireUserId();

  try {
    // Throws if the query names a field outside INVESTMENT_QUERY_FIELDS.
    const serializer = new QuerySerializer<InvestmentView, InvestmentQueryField>(
      userId,
      query,
      INVESTMENT_QUERY_FIELDS
    );

    const results = await dbClient.investment.findMany({
      ...serializer.transform(),
      select: {
        id: true,
        title: true,
        description: true,
        accountType: true,
        institution: true,
        balance: true,
        contributionAmount: true,
        frequency: true,
        anchorDate: true,
        isActive: true,
        bucketId: true,
        categoryId: true,
      },
    });

    return results.map((investment) => ({
      ...investment,
      balance: investment.balance.toNumber(),
      contributionAmount: investment.contributionAmount.toNumber(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    console.error("Investment query error:", message);
    return { error: message };
  }
}
