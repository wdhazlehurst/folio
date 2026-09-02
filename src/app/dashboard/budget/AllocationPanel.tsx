"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";
import { formatCurrency, formatDay } from "@/lib/format";
import type { BucketView, UnallocatedEarningView } from "@/types/budget";

interface AllocationPanelProps {
  buckets: BucketView[];
  unallocated: UnallocatedEarningView[];
  onAllocate: (
    earningId: string,
    allocations: { bucketId: string; amount: number }[]
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Splits confirmed income across buckets.
 *
 * Only confirmed earnings appear here. Projected occurrences are computed rather than stored, so
 * there is no row to allocate — buckets fund from money actually received.
 */
export default function AllocationPanel({ buckets, unallocated, onAllocate }: AllocationPanelProps) {
  const [active, setActive] = useState<UnallocatedEarningView | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string | number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed each bucket with its configured share of what is left, as a starting point.
  useEffect(() => {
    if (!active) return;
    const seeded: Record<string, string | number> = {};
    for (const bucket of buckets) {
      if (!bucket.isActive) continue;
      const suggested =
        bucket.allocationType === "PERCENT"
          ? (active.remaining * bucket.allocationValue) / 100
          : Math.min(bucket.allocationValue, active.remaining);
      seeded[bucket.id] = Math.round(suggested * 100) / 100;
    }
    setAmounts(seeded);
    setError(null);
  }, [active, buckets]);

  const toNumber = (value: string | number | undefined) => {
    if (value === undefined || value === "") return 0;
    const parsed = typeof value === "string" ? parseFloat(value) : value;
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const total = Object.values(amounts).reduce<number>((sum, value) => sum + toNumber(value), 0);
  const over = active ? Math.round(total * 100) > Math.round(active.remaining * 100) : false;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    setError(null);

    const allocations = Object.entries(amounts)
      .map(([bucketId, value]) => ({ bucketId, amount: toNumber(value) }))
      .filter((allocation) => allocation.amount > 0);

    if (!allocations.length) {
      setError("Enter an amount for at least one bucket");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onAllocate(active.earningId, allocations);
      if (!response.ok) {
        setError(response.error ?? "Something went wrong");
        return;
      }
      setActive(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!unallocated.length) {
    return (
      <Text c="dimmed" size="sm">
        Nothing waiting to be assigned. Confirm income on the Earnings page and it will show up here.
      </Text>
    );
  }

  return (
    <>
      <Stack gap="xs">
        {unallocated.map((earning) => (
          <Card key={earning.earningId} withBorder padding="sm">
            <Group justify="space-between" align="center">
              <div>
                <Group gap="xs" align="baseline">
                  <Text fw={500}>{earning.title}</Text>
                  <Text size="xs" c="dimmed">
                    {formatDay(earning.date)}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {formatCurrency(earning.remaining)} of {formatCurrency(earning.netAmount)} left to assign
                </Text>
              </div>
              <Button size="xs" disabled={!buckets.length} onClick={() => setActive(earning)}>
                Assign
              </Button>
            </Group>
          </Card>
        ))}
      </Stack>

      <Modal
        opened={active !== null}
        onClose={() => setActive(null)}
        title={active ? `Assign ${formatCurrency(active.remaining)}` : "Assign"}
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      >
        <form onSubmit={submit}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            {buckets
              .filter((bucket) => bucket.isActive)
              .map((bucket) => (
                <NumberInput
                  key={bucket.id}
                  label={
                    <Group gap={6} component="span">
                      <span>{bucket.title}</span>
                      {bucket.rollover && (
                        <Badge size="xs" variant="light" color="blue">
                          rolls over
                        </Badge>
                      )}
                    </Group>
                  }
                  value={amounts[bucket.id] ?? ""}
                  onChange={(value) => setAmounts((current) => ({ ...current, [bucket.id]: value }))}
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  hideControls
                />
              ))}

            <Group justify="space-between">
              <Text size="sm" c={over ? "red" : "dimmed"}>
                Assigning {formatCurrency(total)}
                {active ? ` of ${formatCurrency(active.remaining)}` : ""}
              </Text>
              <Button type="submit" loading={submitting} disabled={submitting || over}>
                Assign
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
