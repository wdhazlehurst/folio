"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { toDateInputValue } from "@/lib/format";
import type { EarningRuleView } from "@/types/earning";

const FREQUENCY_OPTIONS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "SEMI_MONTHLY", label: "Twice a month" },
  { value: "MONTHLY", label: "Monthly" },
];

interface EarningRuleFormProps {
  opened: boolean;
  onClose: () => void;
  /** Present when editing an existing rule; absent when creating one. */
  rule?: EarningRuleView | null;
  onSubmit: (values: Record<string, unknown>, id?: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function EarningRuleForm({ opened, onClose, rule, onSubmit }: EarningRuleFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grossAmount, setGrossAmount] = useState<string | number>("");
  const [netAmount, setNetAmount] = useState<string | number>("");
  const [frequency, setFrequency] = useState<string | null>("BIWEEKLY");
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [secondDayOfMonth, setSecondDayOfMonth] = useState<string | number>("");
  const [endDate, setEndDate] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reload the fields whenever the modal opens, so editing one rule then another never shows
  // the previous rule's values.
  useEffect(() => {
    if (!opened) return;
    setTitle(rule?.title ?? "");
    setDescription(rule?.description ?? "");
    setGrossAmount(rule?.grossAmount ?? "");
    setNetAmount(rule?.netAmount ?? "");
    setFrequency(rule?.frequency ?? "BIWEEKLY");
    setAnchorDate(toDateInputValue(rule?.anchorDate));
    setSecondDayOfMonth(rule?.secondDayOfMonth ?? "");
    setEndDate(toDateInputValue(rule?.endDate));
    setIsActive(rule?.isActive ?? true);
    setError(null);
  }, [opened, rule]);

  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title || grossAmount === "" || netAmount === "" || !frequency || !anchorDate) {
      setError("Missing required field(s)");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onSubmit(
        {
          title,
          description: description.trim() || undefined,
          grossAmount: toNumber(grossAmount),
          netAmount: toNumber(netAmount),
          frequency,
          anchorDate: new Date(anchorDate),
          secondDayOfMonth: secondDayOfMonth === "" ? null : toNumber(secondDayOfMonth),
          endDate: endDate ? new Date(endDate) : null,
          isActive,
        },
        rule?.id
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={rule ? "Edit income rule" : "New income rule"}
      centered
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="Name"
            placeholder="e.g. Day job"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            maxLength={32}
            data-autofocus
          />
          <Group grow>
            <NumberInput
              label="Gross"
              description="Before taxes"
              leftSection={currencyIcon}
              value={grossAmount}
              onChange={setGrossAmount}
              required
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
            />
            <NumberInput
              label="Net"
              description="What actually lands"
              leftSection={currencyIcon}
              value={netAmount}
              onChange={setNetAmount}
              required
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
            />
          </Group>
          <Select
            label="Frequency"
            data={FREQUENCY_OPTIONS}
            value={frequency}
            onChange={setFrequency}
            required
            allowDeselect={false}
          />
          <DatePickerInput
            label="First pay date"
            description="The date the money hits the account"
            placeholder="Select date"
            value={anchorDate}
            onChange={setAnchorDate}
            required
            firstDayOfWeek={0}
            highlightToday
          />
          {frequency === "SEMI_MONTHLY" && (
            <NumberInput
              label="Second pay day of the month"
              description="The first is taken from the pay date above"
              value={secondDayOfMonth}
              onChange={setSecondDayOfMonth}
              min={1}
              max={31}
              required
            />
          )}
          <DatePickerInput
            label="Ends"
            placeholder="Optional — leave empty to continue indefinitely"
            value={endDate}
            onChange={setEndDate}
            clearable
            firstDayOfWeek={0}
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
            description="A paused rule stops projecting and posting, but keeps income already received"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
          <Group justify="flex-end" mt="xs">
            <Button type="submit" loading={submitting} disabled={submitting}>
              {rule ? "Save" : "Create"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
