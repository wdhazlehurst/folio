"use server";

// Helper for dashbaord Summaries
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

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
