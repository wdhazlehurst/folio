"use client";

import { useState } from "react";
import { TextInput, NumberInput, Button, Select, Group, Stack, Alert, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";

interface Category {
  value: string;
  label: string;
}

/** Payload this form hands to its parent. `category` carries the category id too — `addExpense` reads it. */
export interface NewExpenseFormValues {
  title: string;
  amount: number;
  category: string;
  categoryId: string;
  date: Date;
}

interface ExpenseFormProps {
  categories: Category[];
  onSubmit: (expense: NewExpenseFormValues) => Promise<{ ok: boolean; error?: string } | void>;
  onUpdate: () => void;
}

export default function NewExpenseForm({ categories, onSubmit, onUpdate }: ExpenseFormProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string | number>("");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpened, { open, close }] = useDisclosure(false);

  function resetForm() {
    setTitle("");
    setAmount("");
    setCategory(null);
    setDate(null);
    setError(null);
  }

  /** Dismissing via ✕/Escape should not leave stale values behind for the next open. */
  function handleClose() {
    resetForm();
    close();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !amount || !category || !date) {
      setError("Missing required field(s)");
      return;
    }

    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;

    setSubmitting(true);
    try {
      const response = await onSubmit({
        title,
        amount: parsedAmount,
        category: category,
        categoryId: category,
        date: new Date(date),
      });

      if (response && !response.ok) {
        setError(response.error || "Something went wrong");
        return;
      }

      onUpdate(); // Refresh parent state
      resetForm();
      close();
    } finally {
      setSubmitting(false);
    }
  };

  const currencyIcon = <IconCurrencyDollar size={20} stroke={1.5} />;

  return (
    <>
      <Modal
        opened={modalOpened}
        onClose={handleClose}
        title="New Expense"
        centered
        overlayProps={{
          backgroundOpacity: 0.45,
          blur: 1,
        }}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            <TextInput
              label="Title"
              placeholder="Enter Title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
              data-autofocus
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
            <Group justify="flex-end" mt="xs">
              <Button type="submit" loading={submitting} disabled={submitting}>
                Create
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Button variant="default" onClick={open}>
        Add Expense
      </Button>
    </>
  );
}
