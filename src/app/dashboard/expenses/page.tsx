"use client";

import { useState, useEffect, useCallback } from "react";
import { Stack } from "@mantine/core";
import { addExpense, getUserExpenses, updateExpense } from "@/app/dashboard/expenses/actions";
import { getUserExpenseCategories } from "./categories/actions";
import { Expense, ExpenseCategory } from "@/types/expense";
import ExpenseTable from "./ExpenseTable";
import CategoryManager from "./categories/ExpenseCategoryForm";
import NewExpenseForm from "./NewExpenseForm";
import "@mantine/dates/styles.css";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateExpense = async (updatedExpense: Expense) => {
    const response = await updateExpense(updatedExpense);

    if (response && !response.ok) {
      setError(response.error);
      return;
    }

    await refreshData();
  };

  const refreshData = useCallback(async () => {
    try {
      const [categoriesData, expensesData] = await Promise.all([getUserExpenseCategories(), getUserExpenses()]);

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
    categoryId: string;
  }) => {
    const response = await addExpense(expenseData);

    if (response && !response.ok) {
      setError(response.error);
      return;
    }

    await refreshData(); // reload everything
  };

  console.log(expenses);

  return (
    <Stack>
      {error && <div>{error}</div>}
      <NewExpenseForm
        categories={categories.map((c) => ({ value: c.id, label: c.title }))}
        onSubmit={handleAddExpense}
        onUpdate={refreshData}
      />
      <ExpenseTable expenses={expenses} categories={categories} onUpdateExpense={handleUpdateExpense} />
      <CategoryManager categories={categories} onUpdate={refreshData} />
    </Stack>
  );
}
