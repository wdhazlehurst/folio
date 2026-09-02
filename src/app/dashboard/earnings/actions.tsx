"use server";

import { redirect } from "next/navigation";
import { OccurrenceExceptionAction, PostingStatus, type EarningRule, type EarningException } from "@prisma/client";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { QuerySerializer } from "@/lib/query-builder";
import { EARNING_QUERY_FIELDS, type EarningQueryField } from "@/lib/query-fields";
import { addDaysUtc, daysBetween, todayUtc, toUtcDay } from "@/lib/dates";
import { expandOccurrences, type RecurrenceException, type RecurrenceRule } from "@/lib/recurrence";
import {
  DAYS_PER_MONTH,
  EARNINGS_PROJECTION_HORIZON_DAYS,
  MIN_AVERAGE_COVERAGE_DAYS,
  ROLLING_AVERAGE_WINDOWS,
} from "@/constants";
import type { ActionResult } from "@/types/api";
import {
  NewEarningRuleSchema,
  NewEarningSchema,
  OccurrenceExceptionSchema,
  UpdateEarningSchema,
  type EarningRuleView,
  type EarningView,
  type IncomeAverage,
  type ProjectedOccurrenceView,
} from "@/types/earning";

/**
 * How far back before the watermark each sweep re-scans. An OVERRIDE can pull an occurrence's
 * effective date backwards into a window already swept; re-scanning catches it, and the
 * `[ruleId, scheduledDate]` unique constraint makes the overlap free of side effects.
 */
const MATERIALIZE_LOOKBACK_DAYS = 62;

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

type RuleWithExceptions = EarningRule & { exceptions: EarningException[] };

function toRecurrenceRule(rule: EarningRule): RecurrenceRule {
  return {
    frequency: rule.frequency,
    anchorDate: rule.anchorDate,
    secondDayOfMonth: rule.secondDayOfMonth,
    endDate: rule.endDate,
    isActive: rule.isActive,
    grossAmount: rule.grossAmount.toNumber(),
    netAmount: rule.netAmount.toNumber(),
  };
}

function toRecurrenceException(exception: EarningException): RecurrenceException {
  return {
    scheduledDate: exception.scheduledDate,
    action: exception.action,
    overrideDate: exception.overrideDate,
    overrideGross: exception.overrideGross?.toNumber() ?? null,
    overrideNet: exception.overrideNet?.toNumber() ?? null,
  };
}

function toRuleView(rule: EarningRule): EarningRuleView {
  return {
    id: rule.id,
    title: rule.title,
    description: rule.description,
    grossAmount: rule.grossAmount.toNumber(),
    netAmount: rule.netAmount.toNumber(),
    frequency: rule.frequency,
    anchorDate: rule.anchorDate,
    secondDayOfMonth: rule.secondDayOfMonth,
    endDate: rule.endDate,
    isActive: rule.isActive,
    lastMaterializedThrough: rule.lastMaterializedThrough,
  };
}

/** Session user id, or a redirect. Every exported action starts here. */
async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");
  return userId;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export async function createEarningRule(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = NewEarningRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  try {
    await dbClient.earningRule.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        grossAmount: data.grossAmount,
        netAmount: data.netAmount,
        frequency: data.frequency,
        anchorDate: toUtcDay(data.anchorDate),
        secondDayOfMonth: data.frequency === "SEMI_MONTHLY" ? (data.secondDayOfMonth ?? null) : null,
        endDate: data.endDate ? toUtcDay(data.endDate) : null,
        isActive: data.isActive ?? true,
        userId,
      },
    });
  } catch (error) {
    console.error(`Error creating earning rule: ${error}`);
    return { ok: false, error: "Could not create the income rule" };
  }
  return { ok: true };
}

export async function updateEarningRule(id: string, input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = NewEarningRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  try {
    const updated = await dbClient.earningRule.updateMany({
      where: { id, userId },
      data: {
        title: data.title,
        description: data.description ?? null,
        grossAmount: data.grossAmount,
        netAmount: data.netAmount,
        frequency: data.frequency,
        anchorDate: toUtcDay(data.anchorDate),
        secondDayOfMonth: data.frequency === "SEMI_MONTHLY" ? (data.secondDayOfMonth ?? null) : null,
        endDate: data.endDate ? toUtcDay(data.endDate) : null,
        ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      },
    });
    if (!updated.count) return { ok: false, error: "Income rule not found" };
  } catch (error) {
    console.error(`Error updating earning rule: ${error}`);
    return { ok: false, error: "Could not update the income rule" };
  }
  return { ok: true };
}

/** Pause or resume a rule. A paused rule projects and materialises nothing. */
export async function setEarningRuleActive(id: string, isActive: boolean): Promise<ActionResult> {
  const userId = await requireUserId();

  const updated = await dbClient.earningRule.updateMany({ where: { id, userId }, data: { isActive } });
  if (!updated.count) return { ok: false, error: "Income rule not found" };
  return { ok: true };
}

/**
 * Removes a rule. Earnings it already posted survive with `ruleId` set to null (the FK is
 * `onDelete: SetNull`) — deleting a schedule must not erase income that was actually received.
 */
export async function deleteEarningRule(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const deleted = await dbClient.earningRule.deleteMany({ where: { id, userId } });
  if (!deleted.count) return { ok: false, error: "Income rule not found" };
  return { ok: true };
}

export async function getEarningRules(): Promise<EarningRuleView[]> {
  const userId = await requireUserId();

  const rules = await dbClient.earningRule.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return rules.map(toRuleView);
}

// ---------------------------------------------------------------------------
// Materialisation — the "auto-post" half of auto-post-then-verify
// ---------------------------------------------------------------------------

/**
 * Writes an `Earning` row for every occurrence whose date has passed and that does not already
 * exist, leaving each at `PROJECTED` for the user to confirm or cancel.
 *
 * Idempotent by construction: `createMany({ skipDuplicates })` against the
 * `[ruleId, scheduledDate]` unique constraint means running this twice cannot double-post. It is
 * called on load of the earnings page; the launch-time catch-up checker is a later feature that
 * will call this same function rather than introduce a second code path.
 */
export async function materializeDueEarnings(): Promise<ActionResult> {
  const userId = await requireUserId();

  const today = todayUtc();
  const rules = await dbClient.earningRule.findMany({
    where: { userId, isActive: true },
    include: { exceptions: true },
  });

  try {
    for (const rule of rules as RuleWithExceptions[]) {
      const from = rule.lastMaterializedThrough
        ? addDaysUtc(rule.lastMaterializedThrough, -MATERIALIZE_LOOKBACK_DAYS)
        : rule.anchorDate;

      const due = expandOccurrences(
        toRecurrenceRule(rule),
        rule.exceptions.map(toRecurrenceException),
        from,
        today
      ).filter((occurrence) => !occurrence.skipped);

      if (due.length) {
        await dbClient.earning.createMany({
          data: due.map((occurrence) => ({
            title: rule.title,
            description: rule.description,
            grossAmount: occurrence.grossAmount,
            netAmount: occurrence.netAmount,
            date: occurrence.date,
            scheduledDate: occurrence.scheduledDate,
            status: PostingStatus.PROJECTED,
            ruleId: rule.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      await dbClient.earningRule.update({ where: { id: rule.id }, data: { lastMaterializedThrough: today } });
    }
  } catch (error) {
    console.error(`Error materializing earnings: ${error}`);
    return { ok: false, error: "Could not post due income" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Earnings (materialised rows)
// ---------------------------------------------------------------------------

/** Net already assigned to buckets, per earning id. */
async function allocatedByEarning(userId: string, earningIds: string[]): Promise<Map<string, number>> {
  if (!earningIds.length) return new Map();

  const grouped = await dbClient.bucketAllocation.groupBy({
    by: ["earningId"],
    where: { userId, earningId: { in: earningIds } },
    _sum: { amount: true },
  });
  return new Map(grouped.map((row) => [row.earningId, row._sum.amount?.toNumber() ?? 0]));
}

export async function getEarnings(): Promise<EarningView[]> {
  const userId = await requireUserId();

  const earnings = await dbClient.earning.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { rule: { select: { title: true } } },
  });

  const allocated = await allocatedByEarning(
    userId,
    earnings.map((e) => e.id)
  );

  return earnings.map((earning) => ({
    id: earning.id,
    title: earning.title,
    description: earning.description,
    grossAmount: earning.grossAmount.toNumber(),
    netAmount: earning.netAmount.toNumber(),
    date: earning.date,
    scheduledDate: earning.scheduledDate,
    status: earning.status,
    ruleId: earning.ruleId,
    ruleTitle: earning.rule?.title ?? null,
    allocatedAmount: allocated.get(earning.id) ?? 0,
  }));
}

/** Auto-posted rows still awaiting the user's confirm/cancel. */
export async function getPendingConfirmations(): Promise<EarningView[]> {
  const earnings = await getEarnings();
  return earnings.filter((earning) => earning.status === PostingStatus.PROJECTED);
}

/** A standalone or backdated earning. Backdating is supported deliberately. */
export async function createEarning(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = NewEarningSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  try {
    await dbClient.earning.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        grossAmount: data.grossAmount,
        netAmount: data.netAmount,
        date: toUtcDay(data.date),
        // One-offs have no rule slot. Postgres treats these NULLs as distinct, so any number
        // of them coexist under the [ruleId, scheduledDate] unique constraint.
        scheduledDate: null,
        ruleId: null,
        status: data.status ?? PostingStatus.CONFIRMED,
        confirmedAt: (data.status ?? PostingStatus.CONFIRMED) === PostingStatus.CONFIRMED ? new Date() : null,
        userId,
      },
    });
  } catch (error) {
    console.error(`Error creating earning: ${error}`);
    return { ok: false, error: "Could not add the earning" };
  }
  return { ok: true };
}

export async function updateEarning(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = UpdateEarningSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  try {
    const updated = await dbClient.earning.updateMany({
      where: { id: data.id, userId },
      data: {
        title: data.title,
        description: data.description ?? null,
        grossAmount: data.grossAmount,
        netAmount: data.netAmount,
        date: toUtcDay(data.date),
      },
    });
    if (!updated.count) return { ok: false, error: "Earning not found" };
  } catch (error) {
    console.error(`Error updating earning: ${error}`);
    return { ok: false, error: "Could not update the earning" };
  }
  return { ok: true };
}

/**
 * Deletes a materialised occurrence.
 *
 * If it came from a rule, a SKIP exception is recorded for its slot in the same transaction —
 * otherwise the next materialisation sweep would helpfully recreate the row the user just
 * deleted. Deleting an occurrence therefore means "this one never happened", permanently.
 */
export async function deleteEarning(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const earning = await dbClient.earning.findFirst({ where: { id, userId } });
  if (!earning) return { ok: false, error: "Earning not found" };

  try {
    await dbClient.$transaction(async (tx) => {
      await tx.earning.delete({ where: { id: earning.id } });

      if (earning.ruleId && earning.scheduledDate) {
        await tx.earningException.upsert({
          where: { ruleId_scheduledDate: { ruleId: earning.ruleId, scheduledDate: earning.scheduledDate } },
          create: {
            ruleId: earning.ruleId,
            scheduledDate: earning.scheduledDate,
            action: OccurrenceExceptionAction.SKIP,
            userId,
          },
          update: {
            action: OccurrenceExceptionAction.SKIP,
            overrideDate: null,
            overrideGross: null,
            overrideNet: null,
          },
        });
      }
    });
  } catch (error) {
    console.error(`Error deleting earning: ${error}`);
    return { ok: false, error: "Could not delete the earning" };
  }
  return { ok: true };
}

/** Marks an auto-posted earning as really received. Only CONFIRMED income can fund a bucket. */
export async function confirmEarning(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const updated = await dbClient.earning.updateMany({
    where: { id, userId },
    data: { status: PostingStatus.CONFIRMED, confirmedAt: new Date() },
  });
  if (!updated.count) return { ok: false, error: "Earning not found" };
  return { ok: true };
}

/**
 * Marks an auto-posted earning as not received. The row is kept for audit and excluded from
 * every sum; keeping it is also what stops the next sweep from re-posting the same slot.
 * Any bucket allocations made from it are removed, since the money never arrived.
 */
export async function cancelEarning(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const earning = await dbClient.earning.findFirst({ where: { id, userId } });
  if (!earning) return { ok: false, error: "Earning not found" };

  try {
    await dbClient.$transaction([
      dbClient.bucketAllocation.deleteMany({ where: { earningId: earning.id, userId } }),
      dbClient.earning.update({
        where: { id: earning.id },
        data: { status: PostingStatus.CANCELLED, confirmedAt: null },
      }),
    ]);
  } catch (error) {
    console.error(`Error cancelling earning: ${error}`);
    return { ok: false, error: "Could not cancel the earning" };
  }
  return { ok: true };
}

export async function confirmAllPending(): Promise<ActionResult> {
  const userId = await requireUserId();

  await dbClient.earning.updateMany({
    where: { userId, status: PostingStatus.PROJECTED },
    data: { status: PostingStatus.CONFIRMED, confirmedAt: new Date() },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Projection + exceptions
// ---------------------------------------------------------------------------

/**
 * Future occurrences, computed on every request and never written. They have no id, which is
 * precisely why they cannot be allocated to a bucket — "buckets fund from actual income
 * received, never from projections" is enforced by the schema, not by a convention.
 */
export async function getProjectedOccurrences(horizonDays?: number): Promise<ProjectedOccurrenceView[]> {
  const userId = await requireUserId();

  const today = todayUtc();
  const horizonEnd = addDaysUtc(today, horizonDays ?? EARNINGS_PROJECTION_HORIZON_DAYS);

  const rules = await dbClient.earningRule.findMany({
    where: { userId, isActive: true },
    include: { exceptions: true },
  });

  // A future-dated override can land on a slot that already materialised; never show both.
  const materialized = await dbClient.earning.findMany({
    where: { userId, scheduledDate: { not: null } },
    select: { ruleId: true, scheduledDate: true },
  });
  const taken = new Set(materialized.map((row) => `${row.ruleId}:${row.scheduledDate?.toISOString()}`));

  const projected: ProjectedOccurrenceView[] = [];

  for (const rule of rules as RuleWithExceptions[]) {
    const occurrences = expandOccurrences(
      toRecurrenceRule(rule),
      rule.exceptions.map(toRecurrenceException),
      addDaysUtc(today, 1),
      horizonEnd
    );

    for (const occurrence of occurrences) {
      if (taken.has(`${rule.id}:${occurrence.scheduledDate.toISOString()}`)) continue;
      projected.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        scheduledDate: occurrence.scheduledDate,
        date: occurrence.date,
        grossAmount: occurrence.grossAmount,
        netAmount: occurrence.netAmount,
        skipped: occurrence.skipped,
        overridden: occurrence.overridden,
      });
    }
  }

  return projected.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Skips or overrides one future occurrence. One row per overridden slot. */
export async function setOccurrenceException(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = OccurrenceExceptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const rule = await dbClient.earningRule.findFirst({ where: { id: data.ruleId, userId }, select: { id: true } });
  if (!rule) return { ok: false, error: "Income rule not found" };

  const scheduledDate = toUtcDay(data.scheduledDate);
  const fields = {
    action: data.action,
    overrideDate: data.overrideDate ? toUtcDay(data.overrideDate) : null,
    overrideGross: data.overrideGross ?? null,
    overrideNet: data.overrideNet ?? null,
  };

  try {
    await dbClient.earningException.upsert({
      where: { ruleId_scheduledDate: { ruleId: rule.id, scheduledDate } },
      create: { ruleId: rule.id, scheduledDate, userId, ...fields },
      update: fields,
    });
  } catch (error) {
    console.error(`Error saving occurrence exception: ${error}`);
    return { ok: false, error: "Could not save the change" };
  }
  return { ok: true };
}

/** Restores an occurrence to whatever the rule says. */
export async function clearOccurrenceException(ruleId: string, scheduledDate: Date): Promise<ActionResult> {
  const userId = await requireUserId();

  await dbClient.earningException.deleteMany({ where: { ruleId, scheduledDate: toUtcDay(scheduledDate), userId } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rolling averages — ADVISORY ONLY
// ---------------------------------------------------------------------------

/**
 * Trailing 90/180/365-**day** income averages over CONFIRMED earnings, normalised to a monthly
 * figure.
 *
 * These drive planning and "safe to pull" guidance. They are deliberately not imported by the
 * budget module: buckets fund from actual income received, never from an average.
 *
 * Partial windows degrade gracefully — with 60 days of history the 90-day figure is divided by
 * the 60 days actually covered rather than by 90, so it reads as a real monthly rate, and
 * `partial` + `coverageDays` let the UI label it as being over a short window. Below one month
 * of history the divisor is floored, so a brand-new setup cannot report a wild rate.
 *
 * Coverage is the span of income history of ANY status. Measuring it from confirmed rows only
 * would shrink the divisor while the numerator kept growing, inflating the rate as recent
 * paychecks were confirmed and correcting it only once the oldest one was.
 */
export async function getIncomeAverages(): Promise<IncomeAverage[]> {
  const userId = await requireUserId();

  const today = todayUtc();

  // Coverage measures how much income HISTORY exists — deliberately every status, not just
  // CONFIRMED. A materialised row is evidence the app was tracking income on that date even if
  // it has not been verified yet, and a cancelled one is evidence of a period that genuinely
  // earned nothing.
  //
  // Scoping this to CONFIRMED shrinks the divisor to however far back the user has clicked
  // Confirm, while the numerator still grows with each confirmation — so confirming a recent
  // paycheck inflates the monthly rate, and only confirming the oldest one corrects it.
  const earliest = await dbClient.earning.findFirst({
    where: { userId },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  const averages: IncomeAverage[] = [];

  for (const windowDays of ROLLING_AVERAGE_WINDOWS) {
    const windowStart = addDaysUtc(today, -(windowDays - 1));

    const totals = await dbClient.earning.aggregate({
      where: { userId, status: PostingStatus.CONFIRMED, date: { gte: windowStart, lte: today } },
      _sum: { netAmount: true, grossAmount: true },
    });

    const historyDays = earliest ? daysBetween(earliest.date, today) + 1 : 0;
    const coverageDays = Math.max(0, Math.min(windowDays, historyDays));
    // Report the real coverage for the label, but never divide by less than a month: dividing by
    // a handful of days turns a single paycheck into an absurd annualised rate.
    const scale = DAYS_PER_MONTH / Math.max(coverageDays, MIN_AVERAGE_COVERAGE_DAYS);

    averages.push({
      windowDays,
      monthlyNet: (totals._sum.netAmount?.toNumber() ?? 0) * scale,
      monthlyGross: (totals._sum.grossAmount?.toNumber() ?? 0) * scale,
      partial: coverageDays < windowDays,
      coverageDays,
    });
  }

  return averages;
}

// ---------------------------------------------------------------------------
// Generic query API
// ---------------------------------------------------------------------------

export async function earningApi(query: unknown) {
  const userId = await requireUserId();

  try {
    // Throws if the query names a field outside EARNING_QUERY_FIELDS.
    const serializer = new QuerySerializer<EarningView, EarningQueryField>(userId, query, EARNING_QUERY_FIELDS);

    const results = await dbClient.earning.findMany({
      ...serializer.transform(),
      select: {
        id: true,
        title: true,
        description: true,
        grossAmount: true,
        netAmount: true,
        date: true,
        status: true,
        ruleId: true,
      },
    });

    return results.map((earning) => ({
      ...earning,
      grossAmount: earning.grossAmount.toNumber(),
      netAmount: earning.netAmount.toNumber(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    console.error("Query error:", message);
    return { error: message };
  }
}
