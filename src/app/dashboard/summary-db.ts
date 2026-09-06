"use server";

// Helper for dashbaord Summaries
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { addDaysUtc, monthStartUtc, nextMonthStartUtc, todayUtc } from "@/lib/dates";
import { NET_WORTH_TREND_MONTHS } from "@/constants";

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function firstOfNextMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export type CategorySlice = {
  label: string; // category title
  value: number; // category total expenses
  percent: number; // percentage of total expenses
};

export type DashboardSummary = {
  total: number; // overall total
  categories: CategorySlice[]; //full list (sorted)
  topBar: CategorySlice[]; // top 4 + "Other"
};

// get prevmonth
function prevMonthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 1);
  return { gte: start, lt: end };
}

// get month to month inc/dec
export async function getMonthTotals() {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const cur = { gte: startOfMonth(), lt: firstOfNextMonth() };
  const prev = prevMonthRange();

  const [curSum, prevSum] = await Promise.all([
    dbClient.expense.aggregate({ where: { userId, date: cur }, _sum: { amount: true } }),
    dbClient.expense.aggregate({ where: { userId, date: prev }, _sum: { amount: true } }),
  ]);

  const current = Number(curSum._sum.amount ?? 0);
  const previous = Number(prevSum._sum.amount ?? 0);
  const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return { current, previous, deltaPct };
}

export type MonthTotal = { month: string; total: number };

export async function getMonthlyTrend(months = 6): Promise<MonthTotal[]> {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const expenses = await dbClient.expense.findMany({
    where: { userId, date: { gte: start } },
    select: { amount: true, date: true },
  });

  // Build ordered month buckets
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
    buckets.set(key, 0);
  }

  for (const e of expenses) {
    const d = new Date(e.date);
    const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + Number(e.amount));
    }
  }

  return Array.from(buckets.entries()).map(([month, total]) => ({ month, total }));
}

export async function getMonthlyAssetTrend(months = 6): Promise<MonthTotal[]> {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const assets = await dbClient.asset.findMany({
    where: { userId, date: { gte: start } },
    select: { amount: true, date: true },
  });

  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
    buckets.set(key, 0);
  }

  for (const a of assets) {
    const d = new Date(a.date);
    const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(a.amount));
  }

  return Array.from(buckets.entries()).map(([month, total]) => ({ month, total }));
}

export async function getDashBoardSummary(options?: { month?: boolean }): Promise<DashboardSummary> {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const dateFilter = options?.month ? { gte: startOfMonth(), lt: firstOfNextMonth() } : undefined;

  // Pulls overall total and per-category totals
  const [sum, grouped] = await Promise.all([
    dbClient.expense.aggregate({
      where: { userId, ...(dateFilter ? { date: dateFilter } : {}) },
      _sum: { amount: true },
    }),
    dbClient.expense.groupBy({
      by: ["categoryId"],
      where: { userId, ...(dateFilter ? { date: dateFilter } : {}) },
      _sum: { amount: true },
    }),
  ]);

  // MapcatId -> title
  const ids = grouped.map((g) => g.categoryId).filter(Boolean) as string[];
  const cats = ids.length
    ? await dbClient.expenseCategory.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(cats.map((c) => [c.id, c.title]));

  // convert decimal
  const total = sum._sum.amount ? sum._sum.amount.toNumber() : 0;

  // Build category list
  const categories = grouped
    .map((g) => {
      const value = g._sum.amount ? g._sum.amount.toNumber() : 0;
      const label = g.categoryId ? (titleById.get(g.categoryId) ?? "Uncategorized") : "Uncategorized";
      const percent = total > 0 ? (value / total) * 100 : 0;
      return { label, value, percent };
    })
    .sort((a, b) => b.value - a.value);

  let topBar: CategorySlice[] = categories.slice(0, 4);
  if (categories.length > 4) {
    const othersValue = categories.slice(4).reduce((acc, c) => acc + c.value, 0);
    const othersPercent = total > 0 ? (othersValue / total) * 100 : 0;
    topBar = [...topBar, { label: "Others", value: othersValue, percent: othersPercent }];
  }

  return { total, categories, topBar };
}

// ---------------------------------------------------------------------------
// Net worth — Assets + Investments − Debts (Phase 3)
// ---------------------------------------------------------------------------

export type NetWorth = {
  assets: number;
  investments: number;
  /** Positive: what is owed. It is subtracted, not added. */
  debts: number;
  netWorth: number;
};

export type NetWorthPoint = NetWorth & { month: string };

/**
 * Net worth right now, as the design decision defines it: three separate tables summed, with
 * `Asset` holding only non-investment holdings so nothing is counted twice.
 *
 * Paused accounts and paused debts are included — pausing stops a schedule posting, it does not
 * mean the money stopped existing.
 */
export async function getNetWorth(): Promise<NetWorth> {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const [assetSum, investmentSum, debtSum] = await Promise.all([
    dbClient.asset.aggregate({ where: { userId }, _sum: { amount: true } }),
    dbClient.investment.aggregate({ where: { userId }, _sum: { balance: true } }),
    dbClient.debt.aggregate({ where: { userId }, _sum: { balance: true } }),
  ]);

  const assets = Number(assetSum._sum.amount ?? 0);
  const investments = Number(investmentSum._sum.balance ?? 0);
  const debts = Number(debtSum._sum.balance ?? 0);

  return { assets, investments, debts, netWorth: assets + investments - debts };
}

/**
 * Net worth at the end of each of the last `months` months.
 *
 * Each of the three parts is reconstructed differently, because each stores history differently:
 *
 * - **Assets** are flat dated entries, so the figure is the running total of everything acquired
 *   up to that month.
 * - **Investments** come from `InvestmentSnapshot` — the most recent snapshot on or before the
 *   boundary, per account. This is what the snapshot table is for: it is the only record of
 *   growth that arrived through the market rather than through a contribution.
 * - **Debts** have no snapshot table, so a past balance is rebuilt by adding back every
 *   non-cancelled payment made after that date. That is exact as long as the balance only ever
 *   moved through payments; a balance edited by hand to match a lender's statement (interest
 *   accrues outside this app) shifts the whole reconstructed history by that correction.
 */
export async function getNetWorthTrend(months = NET_WORTH_TREND_MONTHS): Promise<NetWorthPoint[]> {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const today = todayUtc();

  // Month-end boundaries, oldest first. The current month is bounded by today rather than by a
  // future date, so the last point is "now" instead of a partly empty month.
  const boundaries: { label: string; date: Date }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = monthStartUtc(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1)));
    const monthEnd = addDaysUtc(nextMonthStartUtc(monthStart), -1);
    boundaries.push({
      label: monthStart.toLocaleString("default", { month: "short", year: "2-digit", timeZone: "UTC" }),
      date: monthEnd > today ? today : monthEnd,
    });
  }
  const lastDate = boundaries[boundaries.length - 1].date;

  const [assets, snapshots, debts, payments] = await Promise.all([
    dbClient.asset.findMany({ where: { userId, date: { lte: lastDate } }, select: { amount: true, date: true } }),
    dbClient.investmentSnapshot.findMany({
      where: { userId, date: { lte: lastDate } },
      orderBy: { date: "asc" },
      select: { investmentId: true, date: true, balance: true },
    }),
    dbClient.debt.findMany({ where: { userId }, select: { id: true, balance: true } }),
    dbClient.debtPayment.findMany({
      where: { userId, status: { not: "CANCELLED" }, debtId: { not: null } },
      select: { debtId: true, amount: true, date: true },
    }),
  ]);

  return boundaries.map(({ label, date }) => {
    const assetTotal = assets
      .filter((asset) => asset.date <= date)
      .reduce((sum, asset) => sum + Number(asset.amount), 0);

    // Last snapshot on or before the boundary, per account. Snapshots arrive sorted, so the last
    // one written into the map for an account is the newest that qualifies.
    const balanceByAccount = new Map<string, number>();
    for (const snapshot of snapshots) {
      if (snapshot.date <= date) balanceByAccount.set(snapshot.investmentId, Number(snapshot.balance));
    }
    const investmentTotal = [...balanceByAccount.values()].reduce((sum, balance) => sum + balance, 0);

    // Today's balance plus everything paid off since — what was still owed back then.
    const debtTotal = debts.reduce((sum, debt) => {
      const paidSince = payments
        .filter((payment) => payment.debtId === debt.id && payment.date > date)
        .reduce((paid, payment) => paid + Number(payment.amount), 0);
      return sum + Number(debt.balance) + paidSince;
    }, 0);

    return {
      month: label,
      assets: assetTotal,
      investments: investmentTotal,
      debts: debtTotal,
      netWorth: assetTotal + investmentTotal - debtTotal,
    };
  });
}
