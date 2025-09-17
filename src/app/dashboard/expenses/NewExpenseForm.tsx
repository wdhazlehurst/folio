"use client";

import { useState } from "react";
import { TextInput, NumberInput, Button, Select, Group, Alert } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";

interface Category {
  value: string;
  label: string;
}

interface ExpenseFormProps {
  categories: Category[];
  onSubmit: (expense: {
    title: string;
    amount: number;
    category: string;
    date: string; // send ISO string to backend
  }) => Promise<{ ok: boolean; error?: string } | void>;
}

export default function NewExpenseForm({ categories, onSubmit }: ExpenseFormProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string | number>("");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !amount || !category || !date) {
      setError("Missing required field(s)");
      return;
    }

    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;

    const response = await onSubmit({
      title,
      amount: parsedAmount,
      category,
      date: date,
    });

    if (response && !response.ok) {
      setError(response.error || "Something went wrong");
      return;
    }

    // reset form
    setTitle("");
    setAmount("");
    setCategory(null);
    setDate(null);
    setError(null);
  };

    const currencyIcon = <IconCurrencyDollar size={20} stroke={1.5} />;

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Group grow>
        <TextInput
          label="Title"
          placeholder="Enter Title"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <NumberInput
          label="Amount"
          placeholder="Enter Amount"
          leftSection={currencyIcon}
          value={amount}
          onChange={setAmount}
          required
          decimalScale={2}
          fixedDecimalScale
          allowNegative={false}
          hideControls
        />
        <Select
          label="Category"
          placeholder="Select Category"
          data={categories}
          value={category}
          onChange={setCategory}
          required
        />
        <DatePickerInput
          label="Date"
          placeholder="Select Date"
          value={date}
          onChange={setDate}
          required
          clearable={true}
          firstDayOfWeek={0}
          highlightToday={true}
          weekendDays={[]}
        />
        <Button type="submit">Add</Button>
      </Group>
    </form>
  );
}
