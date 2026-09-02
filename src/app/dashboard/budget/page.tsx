"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import {
  allocateEarning,
  createBucket,
  deleteBucket,
  getBucketsWithState,
  getUnallocatedIncome,
  setBucketRollover,
  updateBucket,
} from "./actions";
import AllocationPanel from "./AllocationPanel";
import BucketForm from "./BucketForm";
import { formatCurrency, formatDay } from "@/lib/format";
import type { BucketHealth, BucketView, UnallocatedEarningView } from "@/types/budget";

const HEALTH_COLOR: Record<BucketHealth, string> = {
  ok: "green",
  warning: "yellow",
  overdrawn: "red",
};

const HEALTH_LABEL: Record<BucketHealth, string> = {
  ok: "On track",
  warning: "Running low",
  overdrawn: "Overdrawn",
};

export default function BudgetPage() {
  const [buckets, setBuckets] = useState<BucketView[]>([]);
  const [unallocated, setUnallocated] = useState<UnallocatedEarningView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BucketView | null>(null);

  const refreshData = useCallback(async () => {
    try {
      // getBucketsWithState opens the current month and closes any that ended, which is where
      // the rollover flag takes effect.
      const [bucketsData, unallocatedData] = await Promise.all([getBucketsWithState(), getUnallocatedIncome()]);
      setBuckets(bucketsData);
      setUnallocated(unallocatedData);
    } catch (err) {
      setError("Failed to load budget data");
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const response = await action();
    if (!response.ok) {
      setError(response.error ?? "Something went wrong");
      return response;
    }
    await refreshData();
    return response;
  };

  const handleSubmit = async (values: Record<string, unknown>, id?: string) => {
    const response = id ? await updateBucket({ ...values, id }) : await createBucket(values);
    if (response.ok) {
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleDelete = (bucket: BucketView) => {
    if (!window.confirm(`Delete "${bucket.title}"? Expenses charged to it are kept, but stop being budgeted.`)) {
      return;
    }
    run(() => deleteBucket(bucket.id));
  };

  const periodLabel = buckets[0] ? formatDay(buckets[0].periodStart) : null;

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Budget</Title>
          {periodLabel && (
            <Text size="xs" c="dimmed">
              Month beginning {periodLabel}
            </Text>
          )}
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          New bucket
        </Button>
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {dataLoading ? (
        <Stack gap="xs">
          <Skeleton height={110} />
          <Skeleton height={110} />
        </Stack>
      ) : (
        <>
          {buckets.length === 0 ? (
            <Text c="dimmed" size="sm">
              No buckets yet. Create one to start assigning income — every dollar you confirm can be given a job.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {buckets.map((bucket) => {
                const color = HEALTH_COLOR[bucket.health];
                const progress = bucket.funded > 0 ? Math.min(100, (bucket.spent / bucket.funded) * 100) : 0;
                return (
                  <Card key={bucket.id} withBorder padding="md">
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <div>
                          <Group gap="xs" align="baseline">
                            <Text fw={600}>{bucket.title}</Text>
                            {bucket.rollover && (
                              <Badge size="xs" variant="light" color="blue">
                                rolls over
                              </Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">
                            {bucket.allocationType === "PERCENT"
                              ? `${bucket.allocationValue}% of income`
                              : `${formatCurrency(bucket.allocationValue)} per paycheck`}
                          </Text>
                        </div>
                        <Group gap={2} wrap="nowrap">
                          <Tooltip label="Edit bucket">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => {
                                setEditing(bucket);
                                setModalOpen(true);
                              }}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete bucket">
                            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(bucket)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>

                      <Group justify="space-between" align="baseline">
                        <Text size="xl" fw={700} c={bucket.health === "ok" ? undefined : color}>
                          {formatCurrency(bucket.available)}
                        </Text>
                        <Badge color={color} variant="light">
                          {HEALTH_LABEL[bucket.health]}
                        </Badge>
                      </Group>

                      <Progress value={progress} color={color} />

                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">
                          {formatCurrency(bucket.spent)} spent of {formatCurrency(bucket.funded)}
                        </Text>
                        {bucket.opening !== 0 && (
                          <Text size="xs" c="dimmed">
                            {formatCurrency(bucket.opening)} carried in
                          </Text>
                        )}
                      </Group>

                      <Switch
                        size="xs"
                        label="Roll over next month"
                        checked={bucket.rollover}
                        onChange={(e) => run(() => setBucketRollover(bucket.id, e.currentTarget.checked))}
                      />
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Group gap="xs" align="baseline">
                <Text fw={600}>Income to assign</Text>
                <Text size="xs" c="dimmed">
                  confirmed income only — projections cannot be assigned
                </Text>
              </Group>
              <AllocationPanel
                buckets={buckets}
                unallocated={unallocated}
                onAllocate={(earningId, allocations) => run(() => allocateEarning({ earningId, allocations }))}
              />
            </Stack>
          </Card>
        </>
      )}

      <BucketForm opened={modalOpen} onClose={() => setModalOpen(false)} bucket={editing} onSubmit={handleSubmit} />
    </Stack>
  );
}
