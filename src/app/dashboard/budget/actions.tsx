"use server";

import { redirect } from "next/navigation";
import { PostingStatus, type BudgetBucket } from "@prisma/client";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { QuerySerializer } from "@/lib/query-builder";
import { BUDGET_BUCKET_QUERY_FIELDS, type BudgetBucketQueryField } from "@/lib/query-fields";
import { monthStartUtc, nextMonthStartUtc, todayUtc } from "@/lib/dates";
import { BUCKET_WARNING_RATIO } from "@/constants";
import type { ActionResult } from "@/types/api";
import {
  AllocateEarningSchema,
  NewBucketSchema,
  UpdateBucketSchema,
  type BucketHealth,
  type BucketView,
  type UnallocatedEarningView,
} from "@/types/budget";

/** Safety valve on the month-close chain if the app has been unused for a very long time. */
const MAX_PERIOD_CLOSES = 240;

async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");
  return userId;
}

/** Yellow nearing zero, red overdrawn. */
function bucketHealth(available: number, funded: number): BucketHealth {
  if (available < 0) return "overdrawn";
  if (funded > 0 && available < funded * BUCKET_WARNING_RATIO) return "warning";
  if (funded === 0 && available === 0) return "ok";
  return "ok";
}

/**
 * Money in and out of one bucket for one month.
 *
 * Both figures are derived — allocations from `BucketAllocation`, spend from `Expense` — so
 * neither can drift away from the table it summarises. Only `openingBalance` is stored.
 */
async function periodTotals(userId: string, bucketId: string, periodStart: Date) {
  const periodEnd = nextMonthStartUtc(periodStart);

  const [allocations, spend] = await Promise.all([
    dbClient.bucketAllocation.aggregate({ where: { userId, bucketId, periodStart }, _sum: { amount: true } }),
    dbClient.expense.aggregate({
      where: { userId, bucketId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { amount: true },
    }),
  ]);

  return {
    allocated: allocations._sum.amount?.toNumber() ?? 0,
    spent: spend._sum.amount?.toNumber() ?? 0,
  };
}

/**
 * Opens the current month for every bucket and closes any month that has ended.
 *
 * Closing is where the rollover flag takes effect: an opt-in bucket carries its remaining
 * balance into the next month's `openingBalance`, everything else resets to zero. The step is
 * idempotent and catches up an arbitrary number of months at once, because this app runs
 * locally and is not always on.
 */
export async function ensureCurrentPeriods(): Promise<ActionResult> {
  const userId = await requireUserId();

  const currentStart = monthStartUtc(todayUtc());
  const buckets = await dbClient.budgetBucket.findMany({ where: { userId } });

  try {
    for (const bucket of buckets) {
      for (let i = 0; i < MAX_PERIOD_CLOSES; i++) {
        const stale = await dbClient.bucketPeriod.findFirst({
          where: { userId, bucketId: bucket.id, closedAt: null, periodStart: { lt: currentStart } },
          orderBy: { periodStart: "asc" },
        });
        if (!stale) break;

        const { allocated, spent } = await periodTotals(userId, bucket.id, stale.periodStart);
        const available = stale.openingBalance.toNumber() + allocated - spent;
        // Opt-in rollover: only a rollover bucket carries anything (including an overdraft)
        // into next month. Everything else starts the month at zero.
        const carry = bucket.rollover ? available : 0;
        const nextStart = nextMonthStartUtc(stale.periodStart);

        await dbClient.$transaction([
          dbClient.bucketPeriod.update({ where: { id: stale.id }, data: { closedAt: new Date() } }),
          dbClient.bucketPeriod.upsert({
            where: { bucketId_periodStart: { bucketId: bucket.id, periodStart: nextStart } },
            create: { bucketId: bucket.id, periodStart: nextStart, openingBalance: carry, userId },
            update: { openingBalance: carry },
          }),
        ]);
      }

      await dbClient.bucketPeriod.upsert({
        where: { bucketId_periodStart: { bucketId: bucket.id, periodStart: currentStart } },
        create: { bucketId: bucket.id, periodStart: currentStart, openingBalance: 0, userId },
        // Never rewrite an opening balance a close already computed.
        update: {},
      });
    }
  } catch (error) {
    console.error(`Error rolling budget periods: ${error}`);
    return { ok: false, error: "Could not roll the budget month over" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------

export async function createBucket(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = NewBucketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  try {
    await dbClient.budgetBucket.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        allocationType: data.allocationType,
        allocationValue: data.allocationValue,
        rollover: data.rollover ?? false,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        userId,
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { ok: false, error: "A bucket with that name already exists" };
    }
    console.error(`Error creating bucket: ${error}`);
    return { ok: false, error: "Could not create the bucket" };
  }
  return { ok: true };
}

export async function updateBucket(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = UpdateBucketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  try {
    const updated = await dbClient.budgetBucket.updateMany({
      where: { id: data.id, userId },
      data: {
        title: data.title,
        description: data.description ?? null,
        allocationType: data.allocationType,
        allocationValue: data.allocationValue,
        ...(data.rollover === undefined ? {} : { rollover: data.rollover }),
        ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
        ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      },
    });
    if (!updated.count) return { ok: false, error: "Bucket not found" };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { ok: false, error: "A bucket with that name already exists" };
    }
    console.error(`Error updating bucket: ${error}`);
    return { ok: false, error: "Could not update the bucket" };
  }
  return { ok: true };
}

/** Toggling rollover takes effect at the next month close, not retroactively. */
export async function setBucketRollover(id: string, rollover: boolean): Promise<ActionResult> {
  const userId = await requireUserId();

  const updated = await dbClient.budgetBucket.updateMany({ where: { id, userId }, data: { rollover } });
  if (!updated.count) return { ok: false, error: "Bucket not found" };
  return { ok: true };
}

/**
 * Deletes a bucket. Its periods and allocations cascade away; expenses charged to it survive
 * with `bucketId` set to null, since the spending itself still happened.
 */
export async function deleteBucket(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const deleted = await dbClient.budgetBucket.deleteMany({ where: { id, userId } });
  if (!deleted.count) return { ok: false, error: "Bucket not found" };
  return { ok: true };
}

function toBucketView(
  bucket: BudgetBucket,
  periodStart: Date,
  opening: number,
  allocated: number,
  spent: number
): BucketView {
  const funded = opening + allocated;
  const available = funded - spent;

  return {
    id: bucket.id,
    title: bucket.title,
    description: bucket.description,
    allocationType: bucket.allocationType,
    allocationValue: bucket.allocationValue.toNumber(),
    rollover: bucket.rollover,
    sortOrder: bucket.sortOrder,
    isActive: bucket.isActive,
    periodStart,
    opening,
    allocated,
    spent,
    available,
    funded,
    health: bucketHealth(available, funded),
  };
}

/** Buckets with this month's state. Rolls the month over first so the figures are current. */
export async function getBucketsWithState(): Promise<BucketView[]> {
  const userId = await requireUserId();
  await ensureCurrentPeriods();

  const currentStart = monthStartUtc(todayUtc());
  const periodEnd = nextMonthStartUtc(currentStart);

  const buckets = await dbClient.budgetBucket.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  if (!buckets.length) return [];

  const bucketIds = buckets.map((b) => b.id);

  const [periods, allocations, spends] = await Promise.all([
    dbClient.bucketPeriod.findMany({ where: { userId, bucketId: { in: bucketIds }, periodStart: currentStart } }),
    dbClient.bucketAllocation.groupBy({
      by: ["bucketId"],
      where: { userId, bucketId: { in: bucketIds }, periodStart: currentStart },
      _sum: { amount: true },
    }),
    dbClient.expense.groupBy({
      by: ["bucketId"],
      where: { userId, bucketId: { in: bucketIds }, date: { gte: currentStart, lt: periodEnd } },
      _sum: { amount: true },
    }),
  ]);

  const openingByBucket = new Map(periods.map((p) => [p.bucketId, p.openingBalance.toNumber()]));
  const allocatedByBucket = new Map(allocations.map((a) => [a.bucketId, a._sum.amount?.toNumber() ?? 0]));
  const spentByBucket = new Map(spends.map((s) => [s.bucketId, s._sum.amount?.toNumber() ?? 0]));

  return buckets.map((bucket) =>
    toBucketView(
      bucket,
      currentStart,
      openingByBucket.get(bucket.id) ?? 0,
      allocatedByBucket.get(bucket.id) ?? 0,
      spentByBucket.get(bucket.id) ?? 0
    )
  );
}

// ---------------------------------------------------------------------------
// Funding
// ---------------------------------------------------------------------------

/**
 * Confirmed earnings with net not yet fully assigned.
 *
 * Only `CONFIRMED` rows appear: an auto-posted but unverified earning is not yet "actual income
 * received", and a projected occurrence has no row at all.
 */
export async function getUnallocatedIncome(): Promise<UnallocatedEarningView[]> {
  const userId = await requireUserId();

  const earnings = await dbClient.earning.findMany({
    where: { userId, status: PostingStatus.CONFIRMED },
    orderBy: { date: "desc" },
    select: { id: true, title: true, date: true, netAmount: true },
  });
  if (!earnings.length) return [];

  const grouped = await dbClient.bucketAllocation.groupBy({
    by: ["earningId"],
    where: { userId, earningId: { in: earnings.map((e) => e.id) } },
    _sum: { amount: true },
  });
  const allocatedByEarning = new Map(grouped.map((row) => [row.earningId, row._sum.amount?.toNumber() ?? 0]));

  return earnings
    .map((earning) => {
      const netAmount = earning.netAmount.toNumber();
      const allocated = allocatedByEarning.get(earning.id) ?? 0;
      return {
        earningId: earning.id,
        title: earning.title,
        date: earning.date,
        netAmount,
        allocated,
        remaining: netAmount - allocated,
      };
    })
    .filter((row) => row.remaining > 0.004);
}

/**
 * Splits one confirmed earning across buckets.
 *
 * The `earningId` argument is the whole enforcement of "buckets fund from actual income
 * received, never from projections" — a projected occurrence is computed rather than stored, so
 * there is no id that could be passed here.
 *
 * Funds the month the earning landed in, or the current month if that one is already closed,
 * so allocating a backdated paycheck cannot reopen a settled month.
 */
export async function allocateEarning(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = AllocateEarningSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { earningId, allocations } = parsed.data;

  const earning = await dbClient.earning.findFirst({ where: { id: earningId, userId } });
  if (!earning) return { ok: false, error: "Earning not found" };
  if (earning.status !== PostingStatus.CONFIRMED) {
    return { ok: false, error: "Only confirmed income can be allocated. Confirm the earning first." };
  }

  const bucketIds = allocations.map((a) => a.bucketId);
  if (new Set(bucketIds).size !== bucketIds.length) return { ok: false, error: "Each bucket can appear only once" };

  const owned = await dbClient.budgetBucket.count({ where: { userId, id: { in: bucketIds } } });
  if (owned !== bucketIds.length) return { ok: false, error: "Bucket not found" };

  const requested = allocations.reduce((sum, a) => sum + a.amount, 0);
  // Rounded to cents before comparing: the client sends floats, and the columns are Decimal(12,2).
  if (Math.round(requested * 100) > Math.round(earning.netAmount.toNumber() * 100)) {
    return { ok: false, error: "Allocations exceed the net amount of this earning" };
  }

  const currentStart = monthStartUtc(todayUtc());
  const earningStart = monthStartUtc(earning.date);
  const periodStart = earningStart < currentStart ? currentStart : earningStart;

  try {
    await ensureCurrentPeriods();
    await dbClient.$transaction(async (tx) => {
      for (const allocation of allocations) {
        await tx.bucketPeriod.upsert({
          where: { bucketId_periodStart: { bucketId: allocation.bucketId, periodStart } },
          create: { bucketId: allocation.bucketId, periodStart, openingBalance: 0, userId },
          update: {},
        });

        if (allocation.amount <= 0) {
          await tx.bucketAllocation.deleteMany({ where: { earningId, bucketId: allocation.bucketId, userId } });
          continue;
        }

        await tx.bucketAllocation.upsert({
          where: { earningId_bucketId: { earningId, bucketId: allocation.bucketId } },
          create: { earningId, bucketId: allocation.bucketId, amount: allocation.amount, periodStart, userId },
          update: { amount: allocation.amount, periodStart },
        });
      }
    });
  } catch (error) {
    console.error(`Error allocating earning: ${error}`);
    return { ok: false, error: "Could not allocate this income" };
  }
  return { ok: true };
}

export async function removeAllocation(earningId: string, bucketId: string): Promise<ActionResult> {
  const userId = await requireUserId();

  await dbClient.bucketAllocation.deleteMany({ where: { userId, earningId, bucketId } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Generic query API
// ---------------------------------------------------------------------------

export async function bucketApi(query: unknown) {
  const userId = await requireUserId();

  try {
    // Throws if the query names a field outside BUDGET_BUCKET_QUERY_FIELDS.
    const serializer = new QuerySerializer<BucketView, BudgetBucketQueryField>(
      userId,
      query,
      BUDGET_BUCKET_QUERY_FIELDS
    );

    const results = await dbClient.budgetBucket.findMany({
      ...serializer.transform(),
      select: {
        id: true,
        title: true,
        description: true,
        allocationType: true,
        allocationValue: true,
        rollover: true,
        isActive: true,
      },
    });

    return results.map((bucket) => ({ ...bucket, allocationValue: bucket.allocationValue.toNumber() }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    console.error("Query error:", message);
    return { error: message };
  }
}

/** Lightweight bucket list for select inputs elsewhere (e.g. the expense form). */
export async function getBucketOptions(): Promise<{ value: string; label: string }[]> {
  const userId = await requireUserId();

  const buckets = await dbClient.budgetBucket.findMany({
    where: { userId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, title: true },
  });
  return buckets.map((bucket) => ({ value: bucket.id, label: bucket.title }));
}
