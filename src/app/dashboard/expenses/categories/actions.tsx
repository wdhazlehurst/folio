"use server";

import type { NewExpenseCategory, ExpenseCategory } from "@/types/expense";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

type CategoryResult = { ok: true } | { ok: false; message: string };

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
    },
  });

  return categories;
}
