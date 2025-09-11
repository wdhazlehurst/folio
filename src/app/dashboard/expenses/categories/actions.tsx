"use server";

import type { NewExpenseCategory } from "@/types/expense";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

type CategoryResult = 
    | { ok: true }
    | { ok: false; message: string };

export async function userHasCategory(userId: string, category: string): Promise<boolean> {
    const count = await dbClient.expenseCategory.count({
        where: {
            title: {
                equals: category,
                mode: "insensitive",
            },
            userId: userId,
        }
    });
    return count > 0;
}

export async function addCategory(data: NewExpenseCategory): Promise<CategoryResult | undefined> {
    const userId = await getUserId();

    if (!userId) {
        redirect("/auth/login");
    }

    const hasCategory = await userHasCategory(userId, data.title);
    if (hasCategory) {
        return { ok: false, message: "Category already exists" };
    }

    try {
        const newCategory = await dbClient.expenseCategory.create({
            data: {
                title: data.title,
                description: data.description,
                userId: userId,
            },
        });
        console.log("New category created:", newCategory);
    } catch (error) {
        console.error("Error creating user:", error);
        return { ok: false, message: "Error adding category" };
    }

    return { ok: true };
}

export async function getUserExpenseCategories() {
    const userId = await getUserId();

    if (!userId) {
        redirect("/auth/login");
    }

    const categories = dbClient.expenseCategory.findMany({
        where: { userId },
        select: {
            id: true,
            title: true,
        },
    });

    return categories;

}