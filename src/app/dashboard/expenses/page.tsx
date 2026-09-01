"use client";

import { useState, useEffect, useCallback } from "react";
import { Stack, Button, Group, Text, Title, Alert, Skeleton } from "@mantine/core";
import { addExpense, getUserExpenses, updateExpense, expenseApi } from "@/app/dashboard/expenses/actions";
import { getUserExpenseCategories } from "./categories/actions";
import { Expense, ExpenseCategory } from "@/types/expense";
import ExpenseTable from "./ExpenseTable";
import CategoryManager from "./categories/ExpenseCategoryForm";
import NewExpenseForm, { type NewExpenseFormValues } from "./NewExpenseForm";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [categoriesData, expensesData] = await Promise.all([getUserExpenseCategories(), getUserExpenses()]);
      setCategories(categoriesData);
      setExpenses(expensesData);
    } catch (error) {
      setError("Failed to load data");
      console.error(error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // --- NEW TEST QUERY FUNCTION ---
  const runQuery = async (label: string, query: unknown) => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[${label}] Sending query to Serializer:`, query);
      const results = await expenseApi(query);

      if (results && "error" in results) {
        setError(`[${label}] rejected: ${results.error}`);
      } else {
        console.log(`[${label}] API Success! Results:`, results);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  };

  /** Happy path: every field is on EXPENSE_QUERY_FIELDS, so this should return rows. */
  const runTestQuery = () =>
    runQuery("allowed", {
      filters: {
        title: { contains: "food lion" },
        amount: { min: 10, max: 50 },
        date: {
          after: "2026-02-01T00:00:00Z",
          before: "2026-05-01T00:00:00Z",
        },
      },
      pagination: { limit: 10, page: 1 },
    });

  /** Security check: `userId` is not allowlisted, so the serializer must reject this outright. */
  const runRejectedQuery = () =>
    runQuery("blocked", {
      filters: { userId: { eq: "some-other-users-id" } },
    });

  const handleUpdateExpense = async (updatedExpense: Expense) => {
    setError(null);
    const response = await updateExpense(updatedExpense);
    if (response && !response.ok) {
      setError(response.error);
      return;
    }
    await refreshData();
  };

  const handleAddExpense = async (expenseData: NewExpenseFormValues) => {
    setError(null);
    const response = await addExpense(expenseData);
    if (response && !response.ok) {
      setError(response.error);
      return response;
    }
    await refreshData();
    return response;
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>Expenses</Title>
        <NewExpenseForm
          categories={categories.map((c) => ({ value: c.id, label: c.title }))}
          onSubmit={handleAddExpense}
          onUpdate={refreshData}
        />
      </Group>

      {/* Test Section */}
      <Group justify="space-between" p="md" style={{ border: "1px dashed #228be6", borderRadius: "8px" }}>
        <Text size="sm" fw={500}>
          Query Serializer Test Bench:
        </Text>
        <Group gap="xs">
          <Button variant="light" onClick={runTestQuery} loading={loading}>
            Execute getResponse()
          </Button>
          <Button variant="light" color="red" onClick={runRejectedQuery} loading={loading}>
            Query blocked field
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {dataLoading ? (
        <Stack gap="xs">
          <Skeleton height={32} />
          <Skeleton height={28} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </Stack>
      ) : (
        <ExpenseTable expenses={expenses} categories={categories} onUpdateExpense={handleUpdateExpense} />
      )}

      <CategoryManager categories={categories} onUpdate={refreshData} />
    </Stack>
  );
}
