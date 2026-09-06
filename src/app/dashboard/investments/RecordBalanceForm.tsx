"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { formatCurrency, toDateInputValue } from "@/lib/format";
import type { InvestmentView } from "@/types/investment";

interface RecordBalanceFormProps {
  opened: boolean;
  onClose: () => void;
  investments: InvestmentView[];
  defaultInvestmentId?: string | null;
  onSubmit: (values: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Corrects an account's balance to what the statement actually says, and dates the correction.
 *
 * This is how market growth, interest and fees get in — none of them arrive as a contribution,
 * so without this the balance would only ever be the sum of what was paid in. Each correction
 * also writes that day's snapshot, which is what the net-worth-over-time history is built from.
 */
export default function RecordBalanceForm({
  opened,
  onClose,
  investments,
  defaultInvestmentId,
  onSubmit,
}: RecordBalanceFormProps) {
  const [investmentId, setInvestmentId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | number>("");
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const initialId = defaultInvestmentId ?? investments[0]?.id ?? null;
    setInvestmentId(initialId);
    setBalance(investments.find((investment) => investment.id === initialId)?.balance ?? "");
    setDate(toDateInputValue(new Date()));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, defaultInvestmentId]);

  const selected = investments.find((investment) => investment.id === investmentId) ?? null;
  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const handleSelect = (value: string | null) => {
    setInvestmentId(value);
    setBalance(investments.find((investment) => investment.id === value)?.balance ?? "");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!investmentId || balance === "" || !date) {
      setError("Missing required field(s)");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onSubmit({ investmentId, balance: toNumber(balance), date: new Date(date) });
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
      title="Update balance"
      centered
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <Text size="sm" c="dimmed">
            What the statement says today, including anything the market did. A date in the past fills in history
            without changing the current balance.
          </Text>
          <Select
            label="Account"
            data={investments.map((investment) => ({ value: investment.id, label: investment.title }))}
            value={investmentId}
            onChange={handleSelect}
            required
            allowDeselect={false}
            searchable
          />
          <NumberInput
            label="Balance"
            description={selected ? `Currently ${formatCurrency(selected.balance)}` : undefined}
            leftSection={<IconCurrencyDollar size={20} stroke={1.5} />}
            value={balance}
            onChange={setBalance}
            required
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            hideControls
          />
          <DatePickerInput label="As of" value={date} onChange={setDate} required firstDayOfWeek={0} highlightToday />
          <Group justify="flex-end" mt="xs">
            <Button type="submit" loading={submitting} disabled={submitting || !investments.length}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
