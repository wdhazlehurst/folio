"use client";

import { useState, useEffect, useCallback } from "react";
import { Stack, Button, Group, Text, Code } from "@mantine/core"; // Added Button and Group
import { addExpense, getUserExpenses, updateExpense, expenseApi } from "@/app/dashboard/expenses/actions";
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
  const [loading, setLoading] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [categoriesData, expensesData] = await Promise.all([getUserExpenseCategories(), getUserExpenses()]);
      setCategories(categoriesData);
      setExpenses(expensesData);
    } catch (error) {
      setError("Failed to load data");
      console.error(error);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // --- NEW TEST QUERY FUNCTION ---
  const runTestQuery = async () => {
    setLoading(true);
    setError(null);

    const query = {
      filters: {
        title: { contains: "food" },
        amount: { min: 10, max: 20 },
        date: {
          after: "2026-02-01T00:00:00Z",
          before: "2026-05-01T00:00:00Z",
        },
      },
      // Ensure these fields exist if your Zod schema requires them
      pagination: { limit: 10, page: 1 },
    };

    try {
      console.log("Sending query to Serializer:", query);
      const results = await expenseApi(query);

      if (results && "error" in results) {
        setError(results.error as string);
      } else {
        console.log("API Success! Results:", results);
        // If you want the table to update with these results:
        // setExpenses(results);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExpense = async (updatedExpense: Expense) => {
    const response = await updateExpense(updatedExpense);
    if (response && !response.ok) {
      setError(response.error);
      return;
    }
    await refreshData();
  };

  const handleAddExpense = async (expenseData: any) => {
    const response = await addExpense(expenseData);
    if (response && !response.ok) {
      setError(response.error);
      return;
    }
    await refreshData();
  };

  return (
    <Stack>
      {/* Test Section */}
      <Group justify="space-between" p="md" style={{ border: "1px dashed #228be6", borderRadius: "8px" }}>
        <Text size="sm" fw={500}>
          Query Serializer Test Bench:
        </Text>
        <Button variant="light" onClick={runTestQuery} loading={loading}>
          Execute getResponse()
        </Button>
      </Group>

      {error && (
        <Text color="red" size="sm" bg="red.0" p="xs">
          <strong>Error:</strong> {error}
        </Text>
      )}

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
