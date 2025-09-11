"use server";

import type { NewExpense, Expense } from "@/types/expense";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { getCategoryId } from "./categories/actions";
import { Decimal } from "@prisma/client/runtime/library";
import { redirect } from "next/navigation";


export async function addExpense(data: NewExpense) {
    const userId = await getUserId();

    if (!userId) {
        return;
    }

    const categoryId = await getCategoryId(userId, data.category);
    if (!categoryId) {
        return;
    }

    const newExpense = await dbClient.expense.create({
        data: {
            title: data.title,
            amount: data.amount,
            userId: userId,
            categoryId: categoryId,
        },
    });

    
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