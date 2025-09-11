"use client";

import { useState, useEffect } from "react";
import { TextInput, NumberInput, Button, Select, Table, Group, Stack } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { addExpense, getUserExpenses } from "@/app/dashboard/expenses/actions";
import { getUserExpenseCategories } from "./categories/actions";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: Date;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string | number>('');
  const [category, setCategory] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());

  // Load expenses and categories
  useEffect(() => {
    async function loadData() {
      const categoriesData = await getUserExpenseCategories();
      setCategories(categoriesData.map((c) => ({ value: c.title, label: c.title })));

      const expensesData = await getUserExpenses();
      setExpenses(expensesData);
    }
    loadData();
  }, []);

  // Handle adding a new expense
  const handleAddExpense = async () => {
    if (!title || !amount || !category || !date) return;

    await addExpense({
      title,
      amount,
      category,
      date: date,
    });

    // Refresh the expense list
    const updatedExpenses = await getUserExpenses();
    setExpenses(updatedExpenses);

    // Reset form
    setTitle("");
    setAmount(undefined);
    setCategory("");
    setDate(new Date());
  };

  return (
    <Stack spacing="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAddExpense();
        }}
      >
        <Group grow>
          <TextInput
            placeholder="Expense title"
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />
          <NumberInput
            placeholder="Amount"
            label="Amount"
            value={amount}
            onChange={(value) => setAmount(value ?? '')}
            required
            min={0}
            decimalScale={2}
          />
          <Select
            placeholder="Select category"
            label="Category"
            data={categories}
            value={category}
            onChange={setCategory}
            required
          />
          <DatePicker
            placeholder="Select date"
            label="Date"
            value={date}
            onChange={setDate}
            required
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
