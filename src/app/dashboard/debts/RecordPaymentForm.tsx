"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { formatCurrency, toDateInputValue } from "@/lib/format";
import type { DebtView } from "@/types/debt";

interface RecordPaymentFormProps {
  opened: boolean;
  onClose: () => void;
  debts: DebtView[];
  /** Pre-selected when opened from a debt's own card. */
  defaultDebtId?: string | null;
  onSubmit: (values: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Records a payment made outside the schedule. It fills no slot, so the scheduled payment for
 * the month still posts as normal — this is for an extra or a catch-up payment, not a
 * replacement for one.
 */
export default function RecordPaymentForm({ opened, onClose, debts, defaultDebtId, onSubmit }: RecordPaymentFormProps) {
  const [debtId, setDebtId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | number>("");
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const payable = debts.filter((debt) => !debt.paidOff);

  useEffect(() => {
    if (!opened) return;
    setDebtId(defaultDebtId ?? payable[0]?.id ?? null);
    setAmount("");
    setDate(toDateInputValue(new Date()));
    setError(null);
    // `payable` is derived from `debts` each render; depending on it would reset the form
    // on every parent refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, defaultDebtId]);

  const selected = payable.find((debt) => debt.id === debtId) ?? null;
  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!debtId || amount === "" || !date) {
      setError("Missing required field(s)");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onSubmit({ debtId, amount: toNumber(amount), date: new Date(date) });
      if (!response.ok) {
        setError(response.error ?? "Something went wrong");
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Record a payment"
      centered
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <Text size="sm" c="dimmed">
            A payment made outside the schedule. It reduces the balance and records an expense, exactly as a scheduled
            payment does, and the scheduled one still posts on its own date.
          </Text>
          <Select
            label="Debt"
            data={payable.map((debt) => ({ value: debt.id, label: debt.title }))}
            value={debtId}
            onChange={setDebtId}
            required
            allowDeselect={false}
            searchable
          />
          <NumberInput
            label="Amount"
            description={
              selected
                ? `Balance is ${formatCurrency(selected.balance)}; more than that pays it off exactly`
                : undefined
            }
            leftSection={<IconCurrencyDollar size={20} stroke={1.5} />}
            value={amount}
            onChange={setAmount}
            required
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            hideControls
          />
          <DatePickerInput label="Date" value={date} onChange={setDate} required firstDayOfWeek={0} highlightToday />
          <Group justify="flex-end" mt="xs">
            <Button type="submit" loading={submitting} disabled={submitting || !payable.length}>
              Record
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
