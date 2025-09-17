"use client";

import { useState, useEffect } from "react";
import { Stack } from "@mantine/core";
import { addExpense, getUserExpenses } from "@/app/dashboard/expenses/actions";
import { getUserExpenseCategories } from "./categories/actions";
import { Expense } from "@/types/expense";
import ExpenseTable from "./ExpenseTable";
import CategoryManager from "./categories/ExpenseCategoryForm";
import NewExpenseForm from "./NewExpenseForm";
import "@mantine/dates/styles.css";

interface Category {
  value: string;
  label: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load expenses and categories
  useEffect(() => {
    async function loadData() {
      const categoriesData = await getUserExpenseCategories();
      setCategories(categoriesData.map((c) => ({ value: c.id, label: c.title })));

      const expensesData = await getUserExpenses();
      setExpenses(expensesData);
    }
    loadData();
  }, []);

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

    // Refresh the expense list
    const updatedExpenses = await getUserExpenses();
    setExpenses(updatedExpenses);
  };

  return (
    <Stack>
      <NewExpenseForm categories={categories} onSubmit={handleAddExpense} />
      <ExpenseTable data={expenses} />
      <CategoryManager/>
    </Stack>
  );
}
