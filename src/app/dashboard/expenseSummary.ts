"use server";

import { dbClient } from "@/lib/prisma";
import { ExpenseCategory } from "@prisma/client";
import { getUserId } from "@/lib/auth";

// Calculate Date and Month
function startOfMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function firstOfNextMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export type CategorySlice = {
    label: string;
    value: number;
    percent: number;
};

export type MonthlySummary = {
    total: number;
    byCategory: CategorySlice[];
}

export async function getExpenseSummaryDB(): Promise<MonthlySummary> {
    const userId = await getUserId();
    if (!userId) throw new Error("Unauthorized");

    const gte = startOfMonth()
    const lt = firstOfNextMonth();

    // Ask DB for overall expense Sum
    const [sum, grouped ] = await Promise.all([
        dbClient.expense.aggregate({
            where: { userId, date: { gte, lt} },
            _sum: { amount: true },
        }), // Ask Db per category
        dbClient.expense.groupBy({
            by: ["categoryId"],
            where: { userId, date: { gte, lt} },
            _sum: { amount: true },
        }),
    ]);

    // Pull cat titles for the catIds
    const ids = grouped.map(g => g.categoryId).filter(Boolean) as string[];
    const cats = ids.length
        ? await dbClient.expenseCategory.findMany({
            where: { id: { in: ids } },
            select: { id: true, title: true },
        })
        : [];
    const titleById = new Map(cats.map(c => [c.id, c.title]));

    const total = Number(sum._sum.amount ?? 0);

    const byCategory: CategorySlice[] = grouped.map(g => {
        const value = Number(g._sum.amount ?? 0);
        const label = g.categoryId ? (titleById.get(g.categoryId) ?? "Uncategorized") : "Uncategorized";
        const percent = total > 0 ? (value / total) * 100 : 0;
        return { label, value, percent };
    });
    return { total, byCategory };
}
