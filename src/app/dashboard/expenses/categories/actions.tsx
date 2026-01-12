"use server";

import type { NewExpenseCategory, ExpenseCategory } from "@/types/expense";
import { ActionResult } from "@/types/api";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

type CategoryResult = { ok: true } | { ok: false; message: string };

export async function updateExpenseCategory(data: ExpenseCategory): Promise<ActionResult> {
  const userId = await getUserId();

  if (!userId) redirect("/auth/login");

  try {
    const existingCategory = await dbClient.expenseCategory.findFirst({
      where: {
        id: data.id,
        userId,
      },
    });

    if (!existingCategory) {
      return { ok: false, error: "Category not found" };
    }

    const updated = await dbClient.expenseCategory.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description ?? null,
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("Error updating expense category");
    return { ok: false, error: "Error updating category" };
  }
}

export async function getCategoryById(userId: string, id: string): Promise<string | null> {
  const category = await dbClient.expenseCategory.findFirst({
    where: { id },
  });

  return category ? category.id : null;
}

export async function getCategoryByTitle(userId: string, title: string): Promise<string | null> {
  const category = await dbClient.expenseCategory.findFirst({
    where: {
      title: {
        equals: title,
        mode: "insensitive",
      },
      userId: userId,
    },
  });
  return category ? category.id : null;
}

export async function addCategory(data: NewExpenseCategory): Promise<CategoryResult> {
  const userId = await getUserId();

  if (!userId) {
    redirect("/auth/login");
  }

  const hasCategory = await getCategoryByTitle(userId, data.title);
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
  } catch (error) {
    console.error("Error creating user:", error);
    return { ok: false, message: "Error adding category" };
  }

  return { ok: true };
}

export async function getUserExpenseCategories(): Promise<ExpenseCategory[]> {
  const userId = await getUserId();

  if (!userId) {
    redirect("/auth/login");
  }

  const categories = dbClient.expenseCategory.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      description: true,
    },
  });

  return categories;
}
