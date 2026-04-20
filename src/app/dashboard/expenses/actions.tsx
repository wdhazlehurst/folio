"use server";

import { ExpenseSchema, type Expense } from "@/types/expense";
import { dbClient } from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";
import { getUserId } from "@/lib/auth";
import { getCategoryById } from "./categories/actions";
import { redirect } from "next/navigation";
import { ActionResult, QueryInput } from "@/types/api";
import { getModelData } from "@/services/factory.service";
import { QuerySerializer } from "@/lib/query-builder";

/**
 * Add an `Expense` to the user's database table
 * @param data Expense data
 * @returns Result of creating expense
 */
export async function addExpense(data: Expense): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  const d = new Date(data.date);
  if (isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
  const parsedDate = d.toISOString();
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
  } catch (error) {
    console.error(`Error updating expense: ${error}`);
    return { ok: false, error: "Could not add expense, try again" };
  }
  return { ok: true };
}

/**
 * Updates expense entry in the database
 * @param data Update information, including the expense information and category information
 * @returns Success status and error message if unsuccessful
 */
export async function updateExpense(data: Expense): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  if (!data.categoryId) return { ok: false, error: "Invalid Category selected" };

  try {
    const updatedExpense = await dbClient.expense.update({
      where: {
        id: data.id,
        userId: userId,
      },
      data: {
        title: data.title,
        amount: data.amount,
        categoryId: data.categoryId,
        date: data.date,
      },
    });
    if (!updatedExpense) return { ok: false, error: "Could not update expense" };
    console.log(`Expense '${data.id} updated successfully`);
    return { ok: true };
  } catch (error) {
    console.error(`Error updating expense: ${error}`);
    return { ok: false, error: "Error updating expense" };
  }
}

/**
 * Retrieves all of a user's expenses in the database
 * @returns List of `Expense` objects
 */
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
        select: { title: true, id: true }, // Only need the category title
      },
      date: true,
      userId: true,
    },
    orderBy: {
      date: "desc",
    },
  });

  // Flatten the object
  return expenses.map((e) => ({
    id: e.id,
    title: e.title,
    amount: e.amount.toNumber(),
    category: e.category?.title ?? "N/A",
    categoryId: e.category?.id ?? null,
    date: e.date,
    userId: e.userId,
    // FIXME need to add description/note
  }));
}

/**
 * Fetch expenses given query filters and sorting
 * @param query
 * @returns
 */
export async function expenseApi(query: any) {
  const userId = await getUserId();

  if (!userId) {
    redirect("/auth/login");
  }

  try {
    const serializer = new QuerySerializer(userId, query);
    const prismaQuery = serializer.transform();

    prismaQuery.select = {
      id: true,
      title: true,
      amount: true,
      date: true,
      category: {
        select: { title: true, id: true },
      },
    };

    console.log(prismaQuery);
    const results = await dbClient.expense.findMany(prismaQuery);

    const out = results.map((expense) => ({
      ...expense,
      amount: expense.amount.toNumber(),
    }));
    console.log(out);
    return out;
  } catch (error: any) {
    console.error("Query error:", error.message);
    return { error: error.message };
  }
}
