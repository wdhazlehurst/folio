"use server";

import { redirect } from "next/navigation";
import {
  EarningFrequency,
  OccurrenceExceptionAction,
  PostingStatus,
  type Debt,
  type DebtPaymentException,
  type Prisma,
} from "@prisma/client";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { QuerySerializer } from "@/lib/query-builder";
import { DEBT_QUERY_FIELDS, type DebtQueryField } from "@/lib/query-fields";
import { addDaysUtc, todayUtc, toUtcDay } from "@/lib/dates";
import { expandOccurrences, type Occurrence, type RecurrenceException, type RecurrenceRule } from "@/lib/recurrence";
import { DEBTS_PROJECTION_HORIZON_DAYS } from "@/constants";
import type { ActionResult } from "@/types/api";
import {
  DebtPaymentExceptionSchema,
  NewDebtSchema,
  RecordDebtPaymentSchema,
  UpdateDebtSchema,
  type DebtPaymentView,
  type DebtSummary,
  type DebtView,
  type ProjectedDebtPaymentView,
} from "@/types/debt";

/**
 * How far back before the watermark each sweep re-scans, mirroring the earnings materialiser.
 * An OVERRIDE can pull a payment's effective date backwards into a window already swept;
 * re-scanning catches it, and the `[debtId, scheduledDate]` unique constraint makes the overlap
 * free of side effects.
 */
const MATERIALIZE_LOOKBACK_DAYS = 62;

/** Guard on the per-debt catch-up loop, matching the horizon the projector uses. */
const NEXT_PAYMENT_LOOKAHEAD_DAYS = DEBTS_PROJECTION_HORIZON_DAYS;

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

type DebtWithExceptions = Debt & { exceptions: DebtPaymentException[] };

/** Cents, so repeated float subtraction cannot drift away from a Decimal(12,2) column. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A debt as the pure recurrence module sees it.
 *
 * Monthly is the only cadence, so `anchorDate` carries the day of the month and
 * `addMonthsUtcClamped` handles a 31st anchor landing on a 30-day month. The module is written
 * around a gross/net pair for earnings; a debt has one figure, so both slots carry it.
 */
function toRecurrenceRule(debt: Debt): RecurrenceRule {
  const payment = debt.paymentAmount.toNumber();
  return {
    frequency: EarningFrequency.MONTHLY,
    anchorDate: debt.anchorDate,
    secondDayOfMonth: null,
    endDate: debt.endDate,
    isActive: debt.isActive,
    grossAmount: payment,
    netAmount: payment,
  };
}

function toRecurrenceException(exception: DebtPaymentException): RecurrenceException {
  const override = exception.overrideAmount?.toNumber() ?? null;
  return {
    scheduledDate: exception.scheduledDate,
    action: exception.action,
    overrideDate: exception.overrideDate,
    overrideGross: override,
    overrideNet: override,
  };
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

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export async function createDebt(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = NewDebtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const refError = await assertOwnedRefs(userId, data.bucketId, data.categoryId);
  if (refError) return { ok: false, error: refError };

  try {
    await dbClient.debt.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        balance: data.balance,
        interestRate: data.interestRate,
        minimumPayment: data.minimumPayment,
        paymentAmount: data.paymentAmount,
        anchorDate: toUtcDay(data.anchorDate),
        endDate: data.endDate ? toUtcDay(data.endDate) : null,
        isActive: data.isActive ?? true,
        bucketId: data.bucketId ?? null,
        categoryId: data.categoryId ?? null,
        userId,
      },
    });
  } catch (error) {
    console.error(`Error creating debt: ${error}`);
    return { ok: false, error: "Could not create the debt" };
  }
  return { ok: true };
}

/**
 * Edits a debt. `balance` is editable on purpose — interest accrues outside this app, so the
 * owner has to be able to correct the figure to what the lender actually says.
 */
export async function updateDebt(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = UpdateDebtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const refError = await assertOwnedRefs(userId, data.bucketId, data.categoryId);
  if (refError) return { ok: false, error: refError };

  try {
    const updated = await dbClient.debt.updateMany({
      where: { id: data.id, userId },
      data: {
        title: data.title,
        description: data.description ?? null,
        balance: data.balance,
        interestRate: data.interestRate,
        minimumPayment: data.minimumPayment,
        paymentAmount: data.paymentAmount,
        anchorDate: toUtcDay(data.anchorDate),
        endDate: data.endDate ? toUtcDay(data.endDate) : null,
        bucketId: data.bucketId ?? null,
        categoryId: data.categoryId ?? null,
        ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      },
    });
    if (!updated.count) return { ok: false, error: "Debt not found" };
  } catch (error) {
    console.error(`Error updating debt: ${error}`);
    return { ok: false, error: "Could not update the debt" };
  }
  return { ok: true };
}

/** Pause or resume a debt. A paused debt projects and posts nothing; its balance still counts. */
export async function setDebtActive(id: string, isActive: boolean): Promise<ActionResult> {
  const userId = await requireUserId();

  const updated = await dbClient.debt.updateMany({ where: { id, userId }, data: { isActive } });
  if (!updated.count) return { ok: false, error: "Debt not found" };
  return { ok: true };
}

/**
 * Removes a debt. Payments it already posted survive with `debtId` null (the FK is
 * `onDelete: SetNull`), and the expenses they generated are untouched — money that left the
 * account still left it. Exceptions cascade away with the schedule they belonged to.
 */
export async function deleteDebt(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const deleted = await dbClient.debt.deleteMany({ where: { id, userId } });
  if (!deleted.count) return { ok: false, error: "Debt not found" };
  return { ok: true };
}

/**
 * Every debt with its next scheduled payment.
 *
 * The next payment is expanded from the same pure module the projector and materialiser use, so
 * the date shown on the card is the date that will actually post.
 */
export async function getDebts(): Promise<DebtView[]> {
  const userId = await requireUserId();

  const today = todayUtc();
  const debts = await dbClient.debt.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }],
    include: {
      exceptions: true,
      bucket: { select: { title: true } },
      category: { select: { title: true } },
    },
  });
  if (!debts.length) return [];

  // A slot that already materialised is not "next" — it has been posted.
  const posted = await dbClient.debtPayment.findMany({
    where: { userId, scheduledDate: { not: null } },
    select: { debtId: true, scheduledDate: true },
  });
  const taken = new Set(posted.map((row) => `${row.debtId}:${row.scheduledDate?.toISOString()}`));

  return debts.map((debt) => {
    const balance = debt.balance.toNumber();
    const paidOff = balance <= 0;

    let nextPaymentDate: Date | null = null;
    let nextPaymentAmount: number | null = null;

    if (!paidOff && debt.isActive) {
      const upcoming = expandOccurrences(
        toRecurrenceRule(debt),
        debt.exceptions.map(toRecurrenceException),
        today,
        addDaysUtc(today, NEXT_PAYMENT_LOOKAHEAD_DAYS)
      ).find((occurrence) => !occurrence.skipped && !taken.has(`${debt.id}:${occurrence.scheduledDate.toISOString()}`));

      if (upcoming) {
        nextPaymentDate = upcoming.date;
        // The last payment of a debt is whatever is left, not the full set payment.
        nextPaymentAmount = roundCents(Math.min(upcoming.netAmount, balance));
      }
    }

    return {
      id: debt.id,
      title: debt.title,
      description: debt.description,
      balance,
      interestRate: debt.interestRate.toNumber(),
      minimumPayment: debt.minimumPayment.toNumber(),
      paymentAmount: debt.paymentAmount.toNumber(),
      anchorDate: debt.anchorDate,
      endDate: debt.endDate,
      isActive: debt.isActive,
      bucketId: debt.bucketId,
      bucketTitle: debt.bucket?.title ?? null,
      categoryId: debt.categoryId,
      categoryTitle: debt.category?.title ?? null,
      nextPaymentDate,
      nextPaymentAmount,
      belowMinimum: debt.paymentAmount.toNumber() < debt.minimumPayment.toNumber(),
      paidOff,
    };
  });
}

/** Totals for the page header, and the balance net worth will subtract once it is built. */
export async function getDebtSummary(): Promise<DebtSummary> {
  const userId = await requireUserId();

  const debts = await dbClient.debt.findMany({
    where: { userId, isActive: true },
    select: { balance: true, paymentAmount: true },
  });

  let totalBalance = 0;
  let monthlyCommitment = 0;
  for (const debt of debts) {
    const balance = debt.balance.toNumber();
    totalBalance += balance;
    if (balance > 0) monthlyCommitment += Math.min(debt.paymentAmount.toNumber(), balance);
  }

  return {
    totalBalance: roundCents(totalBalance),
    monthlyCommitment: roundCents(monthlyCommitment),
    debtCount: debts.length,
  };
}

// ---------------------------------------------------------------------------
// Posting — the "auto-post" half of auto-post-then-verify
// ---------------------------------------------------------------------------

/**
 * Writes one payment: the `DebtPayment` row, the balance decrement, and the `Expense`.
 *
 * All three in one transaction, because they are one event — money leaving the account is both a
 * smaller debt and an expense, and a partial write would leave the two disagreeing. The expense
 * carries the debt's `bucketId`, which is the whole of the budget wiring: bucket spend is
 * derived by summing expenses, so a debt payment lands in its bucket with no second mechanism.
 *
 * Returns the amount actually paid, capped at the remaining balance so a final payment clears
 * the debt exactly instead of driving it negative. Returns 0 when there is nothing left to pay.
 */
async function postPayment(
  tx: Prisma.TransactionClient,
  debt: Debt,
  requestedAmount: number,
  date: Date,
  scheduledDate: Date | null,
  status: PostingStatus,
  runningBalance: number
): Promise<number> {
  const amount = roundCents(Math.min(requestedAmount, runningBalance));
  if (amount <= 0) return 0;

  const expense = await tx.expense.create({
    data: {
      title: debt.title,
      description: `Debt payment — ${debt.title}`.slice(0, 256),
      amount,
      userId: debt.userId,
      categoryId: debt.categoryId,
      bucketId: debt.bucketId,
      date,
    },
  });

  await tx.debtPayment.create({
    data: {
      amount,
      date,
      scheduledDate,
      status,
      confirmedAt: status === PostingStatus.CONFIRMED ? new Date() : null,
      debtId: debt.id,
      expenseId: expense.id,
      userId: debt.userId,
    },
  });

  await tx.debt.update({ where: { id: debt.id }, data: { balance: { decrement: amount } } });

  return amount;
}

/** Prisma's unique-constraint violation — here, a slot another sweep already posted. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Posts every payment whose date has passed and that is not already posted, leaving each at
 * `PROJECTED` for the user to confirm or cancel.
 *
 * Idempotent by construction: the `[debtId, scheduledDate]` unique constraint means running this
 * twice cannot double-post, and a collision rolls back that payment's whole transaction — no
 * orphan expense, no double decrement. Called on load of the debts page; the launch-time
 * catch-up checker will call this same function rather than introduce a second code path.
 *
 * Payments are processed oldest first against a running balance, so a debt that clears mid-sweep
 * stops posting rather than going negative.
 */
export async function materializeDueDebtPayments(): Promise<ActionResult> {
  const userId = await requireUserId();

  const today = todayUtc();
  const debts = await dbClient.debt.findMany({
    where: { userId, isActive: true },
    include: { exceptions: true },
  });

  try {
    for (const debt of debts as DebtWithExceptions[]) {
      let runningBalance = debt.balance.toNumber();

      if (runningBalance > 0) {
        const from = debt.lastMaterializedThrough
          ? addDaysUtc(debt.lastMaterializedThrough, -MATERIALIZE_LOOKBACK_DAYS)
          : debt.anchorDate;

        const due = expandOccurrences(
          toRecurrenceRule(debt),
          debt.exceptions.map(toRecurrenceException),
          from,
          today
        ).filter((occurrence) => !occurrence.skipped);

        for (const occurrence of due) {
          if (runningBalance <= 0) break;

          const existing = await dbClient.debtPayment.findFirst({
            where: { debtId: debt.id, scheduledDate: occurrence.scheduledDate },
            select: { id: true },
          });
          if (existing) continue;

          try {
            const paid = await dbClient.$transaction((tx) =>
              postPayment(
                tx,
                debt,
                occurrence.netAmount,
                occurrence.date,
                occurrence.scheduledDate,
                PostingStatus.PROJECTED,
                runningBalance
              )
            );
            runningBalance = roundCents(runningBalance - paid);
          } catch (error) {
            // Another sweep won the race for this slot; it is posted either way.
            if (!isUniqueViolation(error)) throw error;
          }
        }
      }

      await dbClient.debt.update({ where: { id: debt.id }, data: { lastMaterializedThrough: today } });
    }
  } catch (error) {
    console.error(`Error materializing debt payments: ${error}`);
    return { ok: false, error: "Could not post due debt payments" };
  }
  return { ok: true };
}

/**
 * Records a payment by hand — an extra payment, or one made outside the schedule.
 *
 * It has no `scheduledDate`, so it fills no slot and the schedule still posts as normal. This is
 * not the extra-payment slider from the long term goals; it just lets a real payment be entered.
 */
export async function recordDebtPayment(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = RecordDebtPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const debt = await dbClient.debt.findFirst({ where: { id: data.debtId, userId } });
  if (!debt) return { ok: false, error: "Debt not found" };

  const balance = debt.balance.toNumber();
  if (balance <= 0) return { ok: false, error: "This debt is already paid off" };

  try {
    // Recorded by hand, so it is CONFIRMED on arrival — there is nothing to verify later.
    const paid = await dbClient.$transaction((tx) =>
      postPayment(tx, debt, data.amount, toUtcDay(data.date), null, PostingStatus.CONFIRMED, balance)
    );
    if (paid <= 0) return { ok: false, error: "Nothing left to pay on this debt" };
  } catch (error) {
    console.error(`Error recording debt payment: ${error}`);
    return { ok: false, error: "Could not record the payment" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Payments (materialised rows)
// ---------------------------------------------------------------------------

export async function getDebtPayments(): Promise<DebtPaymentView[]> {
  const userId = await requireUserId();

  const payments = await dbClient.debtPayment.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { debt: { select: { title: true } } },
  });

  return payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount.toNumber(),
    date: payment.date,
    scheduledDate: payment.scheduledDate,
    status: payment.status,
    debtId: payment.debtId,
    debtTitle: payment.debt?.title ?? null,
    expenseId: payment.expenseId,
  }));
}

/** Auto-posted payments still awaiting the user's confirm/cancel. */
export async function getPendingDebtPayments(): Promise<DebtPaymentView[]> {
  const payments = await getDebtPayments();
  return payments.filter((payment) => payment.status === PostingStatus.PROJECTED);
}

/**
 * Marks an auto-posted payment as really made. The balance and the expense moved when it posted,
 * so confirming changes nothing but the status — there is no second decrement to make.
 */
export async function confirmDebtPayment(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const updated = await dbClient.debtPayment.updateMany({
    where: { id, userId, status: PostingStatus.PROJECTED },
    data: { status: PostingStatus.CONFIRMED, confirmedAt: new Date() },
  });
  if (!updated.count) return { ok: false, error: "Payment not found" };
  return { ok: true };
}

/**
 * Marks an auto-posted payment as never made, and undoes everything posting it did: the balance
 * is restored and the generated expense deleted, because the money never left the account.
 *
 * The row itself is kept as CANCELLED for audit, and keeping it is also what stops the next
 * sweep re-posting the same slot.
 */
export async function cancelDebtPayment(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const payment = await dbClient.debtPayment.findFirst({ where: { id, userId } });
  if (!payment) return { ok: false, error: "Payment not found" };
  if (payment.status === PostingStatus.CANCELLED) return { ok: true };

  try {
    await dbClient.$transaction(async (tx) => {
      if (payment.debtId) {
        await tx.debt.update({
          where: { id: payment.debtId },
          data: { balance: { increment: payment.amount } },
        });
      }
      if (payment.expenseId) {
        await tx.expense.deleteMany({ where: { id: payment.expenseId, userId } });
      }
      await tx.debtPayment.update({
        where: { id: payment.id },
        data: { status: PostingStatus.CANCELLED, confirmedAt: null, expenseId: null },
      });
    });
  } catch (error) {
    console.error(`Error cancelling debt payment: ${error}`);
    return { ok: false, error: "Could not cancel the payment" };
  }
  return { ok: true };
}

export async function confirmAllPendingDebtPayments(): Promise<ActionResult> {
  const userId = await requireUserId();

  await dbClient.debtPayment.updateMany({
    where: { userId, status: PostingStatus.PROJECTED },
    data: { status: PostingStatus.CONFIRMED, confirmedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Deletes a payment outright.
 *
 * Unless it was already cancelled, this reverses its effects first — balance restored, generated
 * expense removed. If it came from the schedule, a SKIP exception is recorded for its slot in the
 * same transaction; otherwise the next sweep would helpfully recreate the row just deleted.
 * Deleting a payment therefore means "this one never happened", permanently.
 */
export async function deleteDebtPayment(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const payment = await dbClient.debtPayment.findFirst({ where: { id, userId } });
  if (!payment) return { ok: false, error: "Payment not found" };

  const alreadyReversed = payment.status === PostingStatus.CANCELLED;

  try {
    await dbClient.$transaction(async (tx) => {
      if (!alreadyReversed && payment.debtId) {
        await tx.debt.update({
          where: { id: payment.debtId },
          data: { balance: { increment: payment.amount } },
        });
      }
      if (!alreadyReversed && payment.expenseId) {
        await tx.expense.deleteMany({ where: { id: payment.expenseId, userId } });
      }

      await tx.debtPayment.delete({ where: { id: payment.id } });

      if (payment.debtId && payment.scheduledDate) {
        await tx.debtPaymentException.upsert({
          where: { debtId_scheduledDate: { debtId: payment.debtId, scheduledDate: payment.scheduledDate } },
          create: {
            debtId: payment.debtId,
            scheduledDate: payment.scheduledDate,
            action: OccurrenceExceptionAction.SKIP,
            userId,
          },
          update: { action: OccurrenceExceptionAction.SKIP, overrideDate: null, overrideAmount: null },
        });
      }
    });
  } catch (error) {
    console.error(`Error deleting debt payment: ${error}`);
    return { ok: false, error: "Could not delete the payment" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Projection + exceptions
// ---------------------------------------------------------------------------

/**
 * Future payments, computed on every request and never written.
 *
 * Amounts run against a copy of the balance, so the schedule shows the same capped final payment
 * the materialiser would post and stops at payoff instead of listing payments that will never be
 * made. That is the posting rule applied to the display — not an amortization schedule: no
 * interest is accrued, and the balance only ever moves by the payments themselves.
 */
export async function getProjectedDebtPayments(horizonDays?: number): Promise<ProjectedDebtPaymentView[]> {
  const userId = await requireUserId();

  const today = todayUtc();
  const horizonEnd = addDaysUtc(today, horizonDays ?? DEBTS_PROJECTION_HORIZON_DAYS);

  const debts = await dbClient.debt.findMany({
    where: { userId, isActive: true },
    include: { exceptions: true },
  });
  if (!debts.length) return [];

  // A future-dated override can land on a slot that already materialised; never show both.
  const posted = await dbClient.debtPayment.findMany({
    where: { userId, scheduledDate: { not: null } },
    select: { debtId: true, scheduledDate: true },
  });
  const taken = new Set(posted.map((row) => `${row.debtId}:${row.scheduledDate?.toISOString()}`));

  const projected: ProjectedDebtPaymentView[] = [];

  for (const debt of debts as DebtWithExceptions[]) {
    let runningBalance = debt.balance.toNumber();
    if (runningBalance <= 0) continue;

    const occurrences: Occurrence[] = expandOccurrences(
      toRecurrenceRule(debt),
      debt.exceptions.map(toRecurrenceException),
      addDaysUtc(today, 1),
      horizonEnd
    );

    for (const occurrence of occurrences) {
      if (taken.has(`${debt.id}:${occurrence.scheduledDate.toISOString()}`)) continue;

      // A skipped slot is still listed so it can be un-skipped, but it moves no money.
      if (occurrence.skipped) {
        projected.push({
          debtId: debt.id,
          debtTitle: debt.title,
          scheduledDate: occurrence.scheduledDate,
          date: occurrence.date,
          amount: occurrence.netAmount,
          balanceAfter: runningBalance,
          skipped: true,
          overridden: occurrence.overridden,
        });
        continue;
      }

      if (runningBalance <= 0) break;
      const amount = roundCents(Math.min(occurrence.netAmount, runningBalance));
      runningBalance = roundCents(runningBalance - amount);

      projected.push({
        debtId: debt.id,
        debtTitle: debt.title,
        scheduledDate: occurrence.scheduledDate,
        date: occurrence.date,
        amount,
        balanceAfter: runningBalance,
        skipped: false,
        overridden: occurrence.overridden,
      });
    }
  }

  return projected.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Skips or overrides one future payment — the per-month payment-date override the design calls
 * for. One row per overridden slot, and the debt itself is untouched.
 */
export async function setDebtPaymentException(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = DebtPaymentExceptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const debt = await dbClient.debt.findFirst({ where: { id: data.debtId, userId }, select: { id: true } });
  if (!debt) return { ok: false, error: "Debt not found" };

  const scheduledDate = toUtcDay(data.scheduledDate);
  const fields = {
    action: data.action,
    overrideDate: data.overrideDate ? toUtcDay(data.overrideDate) : null,
    overrideAmount: data.overrideAmount ?? null,
  };

  try {
    await dbClient.debtPaymentException.upsert({
      where: { debtId_scheduledDate: { debtId: debt.id, scheduledDate } },
      create: { debtId: debt.id, scheduledDate, userId, ...fields },
      update: fields,
    });
  } catch (error) {
    console.error(`Error saving debt payment exception: ${error}`);
    return { ok: false, error: "Could not save the change" };
  }
  return { ok: true };
}

/** Restores a payment to whatever the schedule says. */
export async function clearDebtPaymentException(debtId: string, scheduledDate: Date): Promise<ActionResult> {
  const userId = await requireUserId();

  await dbClient.debtPaymentException.deleteMany({
    where: { debtId, scheduledDate: toUtcDay(scheduledDate), userId },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Generic query API
// ---------------------------------------------------------------------------

export async function debtApi(query: unknown) {
  const userId = await requireUserId();

  try {
    // Throws if the query names a field outside DEBT_QUERY_FIELDS.
    const serializer = new QuerySerializer<DebtView, DebtQueryField>(userId, query, DEBT_QUERY_FIELDS);

    const results = await dbClient.debt.findMany({
      ...serializer.transform(),
      select: {
        id: true,
        title: true,
        description: true,
        balance: true,
        interestRate: true,
        minimumPayment: true,
        paymentAmount: true,
        anchorDate: true,
        isActive: true,
        bucketId: true,
        categoryId: true,
      },
    });

    return results.map((debt) => ({
      ...debt,
      balance: debt.balance.toNumber(),
      interestRate: debt.interestRate.toNumber(),
      minimumPayment: debt.minimumPayment.toNumber(),
      paymentAmount: debt.paymentAmount.toNumber(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    console.error("Query error:", message);
    return { error: message };
  }
}
