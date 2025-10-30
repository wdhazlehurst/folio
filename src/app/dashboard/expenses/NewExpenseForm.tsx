"use client";

import { useState, useMemo } from "react";
import { TextInput, NumberInput, Button, Select, Group, Alert, Divider, Stack, Switch, Collapse, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";

type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface Category {
  value: string;
  label: string;
}

interface ExpensePayload {
  title: string;
  amount: number;
  category: string;
  date: Date;

  recurrence?: Recurrence;
  interval?: number | null;
  endsOn?: Date | null;
  isActive?: boolean;
}

interface ExpenseFormProps {
  categories: Category[];
  onSubmit: (expense: ExpensePayload) => Promise<{ ok: boolean; error?: string } | void>;
  onUpdate: () => void;
}

export default function NewExpenseForm({ categories, onSubmit, onUpdate }: ExpenseFormProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string | number>("");
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  //reoccuring
  const [recurring, setRecurring] = useState(false);
  const [date, setDate] = useState<Date | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence>("MONTHLY");
  const [interval, setInterval] = useState<number | ''>(1);
  const [endsOn, setEndsOn] = useState<Date | null>(null);

  const getIntervalNumber = (iv: number | '') => (iv === '' ? 1 : Math.max(1, Number(iv)));

  function addInterval(d: Date, freq: Recurrence, n: number) {
    const base = new Date(d.getTime())
    switch (freq) {
      case "DAILY":
        base.setDate(base.getDate() + n);
        break;
      case "WEEKLY":
        base.setDate(base.getDate() + 7 * n);
        break;
      case "MONTHLY":
        base.setMonth(base.getMonth() + n);
        break;
      case "YEARLY":
        base.setFullYear(base.getFullYear() + n);
        break;
      default:
        break;
    }
    return base;
  }

  const nextThreeDates = useMemo(() => {
    if (!recurring || !date) {
      return [];
    }
    const itvl = getIntervalNumber(interval);
    if (!itvl || itvl < 1) {
      return [];
    }
    const out: Date[] = [];
    let cur = new Date(date);
    for (let i = 1; i <= 3; i++) {
      cur = addInterval(cur, recurrence, itvl);
      if (endsOn && cur > endsOn) {
        break;
      }
      out.push(new Date(cur));
    }
    return out;
  }, [recurring, recurrence, interval, date, endsOn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !amount || !category || !date) {
      setError("Missing required field(s)");
      return;
    }

    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (Number.isNaN(parsedAmount)) {
      setError("Amount must be a number");
      return;
    }

    const payload: ExpensePayload = {
      title,
      amount: parsedAmount,
      category,
      date,
    };

    if (recurring) {
      const itvl = getIntervalNumber(interval);
      if (itvl < 1) {
        setError("Interval must be at least 1");
        return;
      }
      payload.recurrence = recurrence;
      payload.interval = itvl;
      payload.endsOn = endsOn ?? null;
      payload.isActive = true; //signal backend worker to apply rule
    } else {
      payload.recurrence = "NONE";
      payload.isActive = false;
      payload.interval = null;
      payload.endsOn = null;
    }

    const response = await onSubmit(payload);

    if (response && !response.ok) {
      setError(response.error || "Something went wrong");
      return;
    }

    onUpdate(); // Refresh parent state

    // reset form
    setTitle("");
    setAmount("");
    setCategory(null);
    setDate(null);
    setError(null);
    setRecurring(false);
    setRecurrence("MONTHLY");
    setEndsOn(null);
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
          onChange={(val) => setDate(val as unknown as Date | null)}
          required
          clearable={true}
          firstDayOfWeek={0}
          highlightToday={true}
          weekendDays={[]}
        />
      </Group>
      <Stack gap="xs" mb="sm">
        <Collapse in={recurring}>
          <Group grow align="flex-end" mt="xs">
            <Select
              label="Frequency"
              placeholder="Select Frequency"
              data={[
                { value: "DAILY", label: "Daily" },
                { value: "WEEKLY", label: "Weekly" },
                { value: "MONTHLY", label: "Monthly" },
                { value: "YEARLY", label: "Yearly" },
              ]}
              value={recurrence}
              onChange={(v) => setRecurrence((v as Recurrence) ?? "MONTHLY")}
              required={recurring}
            />

            <NumberInput
              label="Interval"
              placeholder="Every N periods (weekly, monthly etc)"
              value={recurring ? interval : ''}
              onChange={(v) => setInterval(v === '' ? '' : Number(v))}
              min={1}
              clampBehavior="strict"
              required={recurring}
            />

            <DatePickerInput
              label="Ends on (optional)"
              placeholder="Select Date"
              value={endsOn}
              onChange={(val) => setEndsOn(val as unknown as Date | null)}
              clearable
              firstDayOfWeek={0}
              highlightToday={true}
              weekendDays={[]}
            />
          </Group>
          {date && (
            <Text size="sm" mt="xs" c="dimmed">
              Next {nextThreeDates.length} occurence{nextThreeDates.length === 1 ? "" : "s"}:{" "}
              {nextThreeDates.map((d, i) => d.toLocaleDateString()).join(" · ") || "—"}
            </Text>
          )}
        </Collapse>
      </Stack>
      <Group>
      <Button type="submit">Add</Button>
      <Switch checked={recurring} onChange={(e) => setRecurring(e.currentTarget.checked)}
          label="Recurring"/>
      </Group>
      <Divider my="md" />
    </form>
  );
}
