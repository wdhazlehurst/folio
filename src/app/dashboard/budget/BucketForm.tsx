"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from "@mantine/core";
import { IconCurrencyDollar, IconPercentage } from "@tabler/icons-react";
import type { BucketView } from "@/types/budget";

interface BucketFormProps {
  opened: boolean;
  onClose: () => void;
  bucket?: BucketView | null;
  onSubmit: (values: Record<string, unknown>, id?: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function BucketForm({ opened, onClose, bucket, onSubmit }: BucketFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allocationType, setAllocationType] = useState("PERCENT");
  const [allocationValue, setAllocationValue] = useState<string | number>("");
  const [rollover, setRollover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setTitle(bucket?.title ?? "");
    setDescription(bucket?.description ?? "");
    setAllocationType(bucket?.allocationType ?? "PERCENT");
    setAllocationValue(bucket?.allocationValue ?? "");
    setRollover(bucket?.rollover ?? false);
    setError(null);
  }, [opened, bucket]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title || allocationValue === "") {
      setError("Missing required field(s)");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onSubmit(
        {
          title,
          description: description.trim() || undefined,
          allocationType,
          allocationValue: typeof allocationValue === "string" ? parseFloat(allocationValue) : allocationValue,
          rollover,
        },
        bucket?.id
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={bucket ? "Edit bucket" : "New bucket"}
      centered
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="Name"
            placeholder="e.g. Fun money"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            maxLength={32}
            data-autofocus
          />
          <SegmentedControl
            fullWidth
            value={allocationType}
            onChange={setAllocationType}
            data={[
              { value: "PERCENT", label: "Percentage of income" },
              { value: "FIXED", label: "Fixed amount" },
            ]}
          />
          <NumberInput
            label={allocationType === "PERCENT" ? "Share of each paycheck" : "Amount per paycheck"}
            description="A suggested default when splitting income — you can always override it"
            leftSection={
              allocationType === "PERCENT" ? (
                <IconPercentage size={20} stroke={1.5} />
              ) : (
                <IconCurrencyDollar size={20} stroke={1.5} />
              )
            }
            value={allocationValue}
            onChange={setAllocationValue}
            required
            decimalScale={2}
            allowNegative={false}
            max={allocationType === "PERCENT" ? 100 : undefined}
            hideControls
          />
          <Switch
            label="Roll unspent money into next month"
            description="Off means the bucket resets to zero each month. Turn it on for savings toward a larger purchase."
            checked={rollover}
            onChange={(e) => setRollover(e.currentTarget.checked)}
          />
          <Textarea
            label="Notes"
            placeholder="Optional"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={4}
            maxLength={128}
          />
          <Group justify="flex-end" mt="xs">
            <Button type="submit" loading={submitting} disabled={submitting}>
              {bucket ? "Save" : "Create"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
