"use server";

import type { NewExpense } from "@/types/expense";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";


async function userHasCategory(userId: string, category: string): Promise<boolean> {
    const categories = dbClient.expenseCategory.findFirst({
        where: {
            title: category,
            userId: userId,
        }
    });
    return true;
}

export async function addExpense(data: NewExpense) {
    const userId = await getUserId();

    if (!userId) {
        return;
    }

    
}