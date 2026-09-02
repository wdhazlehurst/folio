"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { toDateInputValue } from "@/lib/format";
import type { EarningView } from "@/types/earning";

interface EarningFormProps {
  opened: boolean;
  onClose: () => void;
  /** Present when editing a materialised occurrence; absent when adding a one-off. */
  earning?: EarningView | null;
  onSubmit: (values: Record<string, unknown>, id?: string) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Adds a standalone earning or edits a materialised one. Backdating is supported deliberately —
 * it is how history gets seeded so the trailing averages have something to work with.
 */
export default function EarningForm({ opened, onClose, earning, onSubmit }: EarningFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grossAmount, setGrossAmount] = useState<string | number>("");
  const [netAmount, setNetAmount] = useState<string | number>("");
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setTitle(earning?.title ?? "");
    setDescription(earning?.description ?? "");
    setGrossAmount(earning?.grossAmount ?? "");
    setNetAmount(earning?.netAmount ?? "");
    setDate(toDateInputValue(earning?.date));
    setError(null);
  }, [opened, earning]);

  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title || grossAmount === "" || netAmount === "" || !date) {
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
          date: new Date(date),
        },
        earning?.id
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
      title={earning ? "Edit earning" : "Add earning"}
      centered
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="Title"
            placeholder="e.g. Bonus"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            maxLength={32}
            data-autofocus
          />
          <Group grow>
            <NumberInput
              label="Gross"
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
          <DatePickerInput
            label="Date received"
            description="Past dates are fine — backdating seeds history for the averages"
            placeholder="Select date"
            value={date}
            onChange={setDate}
            required
            firstDayOfWeek={0}
            highlightToday
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
          <Group justify="flex-end" mt="xs">
            <Button type="submit" loading={submitting} disabled={submitting}>
              {earning ? "Save" : "Add"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
