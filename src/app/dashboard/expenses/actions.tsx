"use server";

import { type Expense } from "@/types/expense";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { getCategoryById } from "./categories/actions";
import { redirect } from "next/navigation";
import { ActionResult } from "@/types/api";
import { QuerySerializer } from "@/lib/query-builder";
import { EXPENSE_QUERY_FIELDS, type ExpenseQueryField } from "@/lib/query-fields";

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
        description: data.description ?? null,
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
        description: data.description ?? null,
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
      description: true,
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
    description: e.description ?? undefined,
    amount: e.amount.toNumber(),
    category: e.category?.title ?? "N/A",
    categoryId: e.category?.id ?? null,
    date: e.date,
    userId: e.userId,
  }));
}

/**
 * Fetch expenses given query filters and sorting
 * @param query
 * @returns
 */
export async function expenseApi(query: unknown) {
  const userId = await getUserId();

  if (!userId) {
    redirect("/auth/login");
  }

  try {
    // Throws if the query names a field outside EXPENSE_QUERY_FIELDS.
    const serializer = new QuerySerializer<Expense, ExpenseQueryField>(userId, query, EXPENSE_QUERY_FIELDS);

    const results = await dbClient.expense.findMany({
      ...serializer.transform(),
      select: {
        id: true,
        title: true,
        description: true,
        amount: true,
        date: true,
        category: {
          select: { title: true, id: true },
        },
      },
    });

    return results.map((expense) => ({
      ...expense,
      amount: expense.amount.toNumber(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    console.error("Query error:", message);
    return { error: message };
  }
}
