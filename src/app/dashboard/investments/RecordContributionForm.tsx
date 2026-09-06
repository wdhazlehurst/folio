"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { formatCurrency, toDateInputValue } from "@/lib/format";
import type { InvestmentView } from "@/types/investment";

const KIND_OPTIONS = [
  { value: "EMPLOYEE", label: "Contribution — my money going in" },
  { value: "ROLLOVER", label: "Rollover in — money from another account" },
  { value: "WITHDRAWAL", label: "Withdrawal — money coming out" },
];

const KIND_TITLES: Record<string, string> = {
  EMPLOYEE: "Record a contribution",
  ROLLOVER: "Record a rollover",
  WITHDRAWAL: "Record a withdrawal",
};

const KIND_HELP: Record<string, string> = {
  EMPLOYEE:
    "Your own money going in, outside the schedule. It uses up this year's contribution room, and the scheduled contribution still posts on its own date.",
  ROLLOVER:
    "Money moved in from another account — an old 401(k) into an IRA, say. It raises the balance but uses none of your annual room, because it is money you already had.",
  WITHDRAWAL:
    "Money coming out of the account. It lowers the balance and is not recorded as spending. It does not give back contribution room — taking money out in June does not let you put more in later.",
};

interface RecordContributionFormProps {
  opened: boolean;
  onClose: () => void;
  investments: InvestmentView[];
  /** Pre-selected when opened from an account's own card. */
  defaultInvestmentId?: string | null;
  onSubmit: (values: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Moves money in or out of an account, outside the schedule.
 *
 * One modal covers all three kinds because they differ only in direction and in what they count
 * against: a contribution is your money going in and uses your annual room, a rollover is money
 * you already had and uses none, and a withdrawal takes money out — and does **not** give the
 * room back. Whichever is chosen, it fills no schedule slot, so a scheduled contribution still
 * posts on its own date.
 */
export default function RecordContributionForm({
  opened,
  onClose,
  investments,
  defaultInvestmentId,
  onSubmit,
}: RecordContributionFormProps) {
  const [investmentId, setInvestmentId] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>("EMPLOYEE");
  const [amount, setAmount] = useState<string | number>("");
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setInvestmentId(defaultInvestmentId ?? investments[0]?.id ?? null);
    setKind("EMPLOYEE");
    setAmount("");
    setDate(toDateInputValue(new Date()));
    setError(null);
    // `investments` is refetched by the parent after every mutation; depending on it would reset
    // the form mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, defaultInvestmentId]);

  const selected = investments.find((investment) => investment.id === investmentId) ?? null;
  const isWithdrawal = kind === "WITHDRAWAL";
  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!investmentId || amount === "" || !date) {
      setError("Missing required field(s)");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onSubmit({ investmentId, amount: toNumber(amount), date: new Date(date), kind });
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
      title={KIND_TITLES[kind ?? "EMPLOYEE"]}
      centered
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <Text size="sm" c="dimmed">
            {KIND_HELP[kind ?? "EMPLOYEE"]}
          </Text>
          <Select
            label="What is this?"
            data={KIND_OPTIONS}
            value={kind}
            onChange={setKind}
            required
            allowDeselect={false}
          />
          <Select
            label="Account"
            data={investments.map((investment) => ({ value: investment.id, label: investment.title }))}
            value={investmentId}
            onChange={setInvestmentId}
            required
            allowDeselect={false}
            searchable
          />
          <NumberInput
            label="Amount"
            description={
              selected
                ? isWithdrawal
                  ? `Balance is ${formatCurrency(selected.balance)}; this takes money out of it`
                  : selected.fundedFromAccount && kind === "EMPLOYEE"
                    ? `Balance is ${formatCurrency(selected.balance)}; this also records an expense`
                    : `Balance is ${formatCurrency(selected.balance)}; no expense is recorded`
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
            <Button
              type="submit"
              color={isWithdrawal ? "orange" : undefined}
              loading={submitting}
              disabled={submitting || !investments.length}
            >
              Record
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
