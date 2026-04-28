"use client";

import { useState } from "react";
import { TextInput, NumberInput, Button, Select, Group, Alert, Modal, Switch, Text, Divider } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { getUserExpenseCategories } from "@/app/dashboard/expenses/categories/actions";
import { addExpense } from "@/app/dashboard/expenses/actions";

interface Category {
  value: string;
  label: string;
}

interface NewAssetFormProps {
  categories: Category[];
  onSubmit: (asset: {
    title: string;
    amount: number;
    isCash: boolean;
    categoryId: string | null;
    date: Date;
  }) => Promise<{ ok: boolean; error?: string } | void>;
  onUpdate: () => void;
}

export default function NewAssetForm({ categories, onSubmit, onUpdate }: NewAssetFormProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string | number>("");
  const [isCash, setIsCash] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpened, { open, close }] = useDisclosure(false);

  const [addToExpenses, setAddToExpenses] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [expenseCategoryId, setExpenseCategoryId] = useState<string | null>(null);
  const [expenseCategoriesLoaded, setExpenseCategoriesLoaded] = useState(false);

  async function handleExpenseToggle(checked: boolean) {
    setAddToExpenses(checked);
    if (checked && !expenseCategoriesLoaded) {
      const data = await getUserExpenseCategories();
      setExpenseCategories(data.map((c) => ({ value: c.id, label: c.title })));
      setExpenseCategoriesLoaded(true);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !amount || !date) {
      setError("Missing required field(s)");
      return;
    }

    if (addToExpenses && !expenseCategoryId) {
      setError("Select an expense category or disable 'Add to expenses'");
      return;
    }

    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    const parsedDate = new Date(date);

    const response = await onSubmit({
      title,
      amount: parsedAmount,
      isCash,
      categoryId: category,
      date: parsedDate,
    });

    if (response && !response.ok) {
      setError(response.error || "Something went wrong");
      return;
    }

    if (addToExpenses && expenseCategoryId) {
      await addExpense({
        title,
        amount: parsedAmount,
        category: expenseCategoryId,
        categoryId: expenseCategoryId,
        date: parsedDate,
      });
    }

    onUpdate();
    setTitle("");
    setAmount("");
    setIsCash(false);
    setCategory(null);
    setDate(null);
    setError(null);
    setAddToExpenses(false);
    setExpenseCategoryId(null);
    close();
  };

  return (
    <>
      <Modal
        opened={modalOpened}
        onClose={close}
        title="New Asset"
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      >
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert color="red" mb="md">
              {error}
            </Alert>
          )}
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
            leftSection={<IconCurrencyDollar size={20} stroke={1.5} />}
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
            placeholder="Select Category (optional)"
            data={categories}
            value={category}
            onChange={setCategory}
            clearable
            mt="xs"
          />
          <DatePickerInput
            label="Date"
            placeholder="Select Date"
            value={date}
            onChange={setDate}
            required
            clearable
            firstDayOfWeek={0}
            highlightToday
            weekendDays={[]}
            mt="xs"
          />
          <Switch
            label="Liquid / Cash equivalent"
            description="Can this asset be quickly converted to cash?"
            checked={isCash}
            onChange={(e) => setIsCash(e.currentTarget.checked)}
            mt="md"
          />
          <Divider mt="md" />
          <Switch
            label="Add to expenses?"
            checked={addToExpenses}
            onChange={(e) => handleExpenseToggle(e.currentTarget.checked)}
            mt="md"
          />
          <Text size="xs" c="dimmed" mt={4}>
            Does this asset cost money now? e.g. buying crypto means money leaves your account today.
          </Text>
          {addToExpenses && (
            <Select
              label="Expense category"
              placeholder="Select expense category"
              data={expenseCategories}
              value={expenseCategoryId}
              onChange={setExpenseCategoryId}
              required
              mt="xs"
            />
          )}
          <Group justify="flex-end" mt="md">
            <Button type="submit">Create</Button>
          </Group>
        </form>
      </Modal>

      <Button variant="default" onClick={open}>
        Add Asset
      </Button>
    </>
  );
}
