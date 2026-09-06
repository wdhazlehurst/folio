"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar, IconPercentage } from "@tabler/icons-react";
import { toDateInputValue } from "@/lib/format";
import type { DebtView } from "@/types/debt";

interface DebtFormProps {
  opened: boolean;
  onClose: () => void;
  /** Present when editing an existing debt; absent when creating one. */
  debt?: DebtView | null;
  bucketOptions: { value: string; label: string }[];
  categoryOptions: { value: string; label: string }[];
  onSubmit: (values: Record<string, unknown>, id?: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function DebtForm({ opened, onClose, debt, bucketOptions, categoryOptions, onSubmit }: DebtFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [balance, setBalance] = useState<string | number>("");
  const [interestRate, setInterestRate] = useState<string | number>("");
  const [minimumPayment, setMinimumPayment] = useState<string | number>("");
  const [paymentAmount, setPaymentAmount] = useState<string | number>("");
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [bucketId, setBucketId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reload the fields whenever the modal opens, so editing one debt then another never shows
  // the previous debt's values.
  useEffect(() => {
    if (!opened) return;
    setTitle(debt?.title ?? "");
    setDescription(debt?.description ?? "");
    setBalance(debt?.balance ?? "");
    setInterestRate(debt?.interestRate ?? "");
    setMinimumPayment(debt?.minimumPayment ?? "");
    setPaymentAmount(debt?.paymentAmount ?? "");
    setAnchorDate(toDateInputValue(debt?.anchorDate));
    setEndDate(toDateInputValue(debt?.endDate));
    setBucketId(debt?.bucketId ?? null);
    setCategoryId(debt?.categoryId ?? null);
    setIsActive(debt?.isActive ?? true);
    setError(null);
  }, [opened, debt]);

  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title || balance === "" || interestRate === "" || minimumPayment === "" || paymentAmount === "") {
      setError("Missing required field(s)");
      return;
    }
    if (!anchorDate) {
      setError("A first payment date is required");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onSubmit(
        {
          title,
          description: description.trim() || undefined,
          balance: toNumber(balance),
          interestRate: toNumber(interestRate),
          minimumPayment: toNumber(minimumPayment),
          paymentAmount: toNumber(paymentAmount),
          // `anchorDate` is `YYYY-MM-DD`, which `new Date` parses as UTC midnight — the shape a
          // @db.Date column wants.
          anchorDate: new Date(anchorDate),
          endDate: endDate ? new Date(endDate) : null,
          bucketId,
          categoryId,
          isActive,
        },
        debt?.id
      );

      if (!response.ok) {
        setError(response.error ?? "Something went wrong");
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const currencyIcon = <IconCurrencyDollar size={20} stroke={1.5} />;
  const belowMinimum =
    minimumPayment !== "" && paymentAmount !== "" && toNumber(paymentAmount) < toNumber(minimumPayment);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={debt ? "Edit debt" : "New debt"}
      centered
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="Name"
            placeholder="e.g. Car loan"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            maxLength={32}
            data-autofocus
          />
          <Group grow>
            <NumberInput
              label="Balance"
              description="What is still owed"
              leftSection={currencyIcon}
              value={balance}
              onChange={setBalance}
              required
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
            />
            <NumberInput
              label="Interest rate"
              description="Annual, as a percent"
              leftSection={<IconPercentage size={20} stroke={1.5} />}
              value={interestRate}
              onChange={setInterestRate}
              required
              decimalScale={4}
              allowNegative={false}
              max={99.9999}
              hideControls
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Minimum payment"
              description="What the lender requires"
              leftSection={currencyIcon}
              value={minimumPayment}
              onChange={setMinimumPayment}
              required
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
            />
            <NumberInput
              label="Payment"
              description="What you actually pay"
              leftSection={currencyIcon}
              value={paymentAmount}
              onChange={setPaymentAmount}
              required
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
              error={belowMinimum ? "Below the minimum" : undefined}
            />
          </Group>
          <DatePickerInput
            label="First payment date"
            description="Every later payment falls on this day of the month"
            placeholder="Select date"
            value={anchorDate}
            onChange={setAnchorDate}
            required
            firstDayOfWeek={0}
            highlightToday
          />
          <DatePickerInput
            label="Ends"
            placeholder="Optional — leave empty to run until it is paid off"
            value={endDate}
            onChange={setEndDate}
            clearable
            firstDayOfWeek={0}
          />
          <Select
            label="Budget bucket"
            description="The payment is charged here, as an expense in this bucket"
            placeholder="Optional — no bucket"
            data={bucketOptions}
            value={bucketId}
            onChange={setBucketId}
            clearable
            searchable
          />
          <Select
            label="Expense category"
            description="The category the generated expense is filed under"
            placeholder="Optional — uncategorised"
            data={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            clearable
            searchable
          />
          <Textarea
            label="Notes"
            placeholder="Optional"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={4}
            maxLength={256}
          />
          <Switch
            label="Active"
            description="A paused debt stops posting payments; its balance still counts against net worth"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
          <Group justify="flex-end" mt="xs">
            <Button type="submit" loading={submitting} disabled={submitting}>
              {debt ? "Save" : "Create"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
