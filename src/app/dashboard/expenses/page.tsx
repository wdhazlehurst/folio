"use client";

import { useState, useEffect, useCallback } from "react";
import { Stack } from "@mantine/core";
import { addExpense, getUserExpenses } from "@/app/dashboard/expenses/actions";
import { getUserExpenseCategories } from "./categories/actions";
import { Expense } from "@/types/expense";
import ExpenseTable from "./ExpenseTable";
import CategoryManager from "./categories/ExpenseCategoryForm";
import NewExpenseForm from "./NewExpenseForm";
import "@mantine/dates/styles.css";

interface Category {
  id: string;
  title: string;
  description?: string | null;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [categoriesData, expensesData] = await Promise.all([
        getUserExpenseCategories(),
        getUserExpenses(),
      ]);

      setCategories(categoriesData); // keep full objects
      setExpenses(expensesData);
    } catch (error) {
      setError("Failed to load data");
      console.error(error);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleAddExpense = async (expenseData: {
    title: string;
    amount: number;
    category: string;
    date: Date;
  }) => {
    const response = await addExpense(expenseData);

    if (response && !response.ok) {
      setError(response.error);
      return;
    }

    await refreshData(); // reload everything
  };

  return (
    <Stack>
      {error && <div>{error}</div>}
      <NewExpenseForm
        categories={categories.map((c) => ({ value: c.id, label: c.title }))}
        onSubmit={handleAddExpense}
        onUpdate={refreshData}
      />
      <ExpenseTable data={expenses} />
      <CategoryManager categories={categories} onUpdate={refreshData} />
    </Stack>
  );
}
