"use client";

import { useState, useEffect } from "react";
import { Stack } from "@mantine/core";
import { addExpense, getUserExpenses } from "@/app/dashboard/expenses/actions";
import { getUserExpenseCategories } from "./categories/actions";
import ExpenseTable from "./ExpenseTable";
import NewExpenseForm from "./NewExpenseForm";
import "@mantine/dates/styles.css";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: Date;
}

interface Category {
  value: string;
  label: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

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
    date: string;
  }) => {
    const response = await addExpense(expenseData);

    if (response && !response.ok) {
      return response;
    }

    // Refresh the expense list
    const updatedExpenses = await getUserExpenses();
    setExpenses(updatedExpenses);

    return { ok: true };
  };

  return (
    <Stack>
      <NewExpenseForm categories={categories} onSubmit={handleAddExpense} />
      <ExpenseTable></ExpenseTable>
      
    </Stack>
  );
}
