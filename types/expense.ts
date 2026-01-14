import * as z from "zod";

export const ExpenseSchema = z.object({
  id: z.uuid().optional(),
  userId: z.uuid().optional(),
  title: z.string(),
  amount: z.number(),
  category: z.string(),
  categoryId: z.uuid(),
  description: z.string().optional(),
  date: z.date(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const ExpenseCategorySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
});
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

/**
 * Client -> Server: data required to create new expense
 * Backend fills in userId + id automatically
 */
export interface NewExpense {
  title: string;
  amount: number;
  category: string;
  description?: string;
  date: string;
}

export interface NewExpenseCategory {
  title: string;
  description: string;
}
