"use client";

import { useState, useEffect } from "react";
import { TextInput, NumberInput, Button, Select, Table, Group, Stack, Alert } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { addExpense, getUserExpenses } from "@/app/dashboard/expenses/actions";
import { getUserExpenseCategories } from "./categories/actions";
import '@mantine/dates/styles.css';


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
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<string | number>('');
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
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

  // Handle adding a new expense
  const handleAddExpense = async () => {
    if (!title || !amount || !category || !date) {
      setError("Missing required field(s)");
      return;
    }

    const parsedAmount = typeof amount === "string" ? parseFloat(amount): amount;
    let response = await addExpense({
      title,
      amount: parsedAmount,
      category,
      date: date,
    });

    if (response && !response.ok) {
      setError(response.error);
      return;
    }

    // Refresh the expense list
    const updatedExpenses = await getUserExpenses();
    setExpenses(updatedExpenses);

    // Reset form
    setTitle('');
    setAmount('');
    setCategory(null);
    setDate(null);
    setError(null);
  };

  return (
    <Stack>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAddExpense();
        }}
      >
        <Group grow>
          <TextInput
            placeholder="Expense Title"
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />
          <NumberInput
            placeholder="Expense Amount"
            label="Amount"
            prefix="$"
            value={amount}
            onChange={setAmount}
            required
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
          />
          <Select
            placeholder="Select Category"
            label="Category"
            data={categories}
            value={category}
            onChange={setCategory}
            required
          />
          <DatePickerInput
            label="Select Date"
            value={date}
            onChange={setDate}
          />
          <Button type="submit">Add</Button>
        </Group>
      </form>

      <Table striped highlightOnHover>
        <thead>
          <tr>
            <th>Title</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>{e.title}</td>
              <td>${e.amount.toFixed(2)}</td>
              <td>{e.category}</td>
              <td>{new Date(e.date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Stack>
  );
}
