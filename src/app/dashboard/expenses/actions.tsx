"use server";

import type { NewExpense, Expense } from "@/types/expense";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { getCategoryById } from "./categories/actions";
import { redirect } from "next/navigation";
import { ActionResult } from "@/types/api";
import { parse } from "path";


export async function addExpense(data: NewExpense): Promise<ActionResult> {
    const userId = await getUserId();
    if (!userId) redirect("/auth/login");

    let parsedDate: string = "";
    if (data.date) {
        const d = new Date(data.date);
        if(!isNaN(d.getTime())) {
            parsedDate = d.toISOString();
        } else {
            return { ok: false, error: "Invalid Date" };
        }
    }
    console.log("CATEGORY:", data.category);
    const categoryId = await getCategoryById(userId, data.category);
    if (!categoryId) {
        return { ok: false, error: "Selected Category doesn't exist" };
    }

    try {
        const newExpense = await dbClient.expense.create({
            data: {
                title: data.title,
                amount: data.amount,
                userId: userId,
                categoryId: categoryId,
                date: parsedDate,
            },
        });
        if (!newExpense) return { ok: false, error: "Could not add expense" };
    } catch(error) {
        return { ok: false, error: "Could not add expense, try again" };
    }
    return { ok: true };
}

export async function getUserExpenses(): Promise<Expense[]> {
    const userId = await getUserId();

    if (!userId) {
        redirect("/auth/login");
    }

    const expenses = await dbClient.expense.findMany({
        where: { userId },
        select: {
            id: true,
            title: true,
            amount: true,
            category: {
                select: { title: true },    // Only need the category title
            },
            date: true,
        }
    })

    return expenses.map((e) => ({
        id: e.id,
        title: e.title,
        amount: Number(e.amount),
        category: e.category ? e.category.title : "error",
        date: e.date,
    }));
}