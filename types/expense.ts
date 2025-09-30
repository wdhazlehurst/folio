import * as z from "zod";

const ExpenseSchema = z.object({
  id: z.uuid().optional(),
  userId: z.uuid().optional(),
  title: z.string(),
  amount: z.number(),
  category: z.string(),
  categoryId: z.uuid().optional(),
  description: z.string().optional(),
  date: z.date(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

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

export interface ExpenseCategory {
  id: string;
  title: string;
  description?: string;
}
