"use client";

import { useState } from "react";
import { Badge, Card, Group, SegmentedControl, Stack, Text, Tooltip } from "@mantine/core";
import { formatCurrency } from "@/lib/format";
import type { IncomeAverage } from "@/types/earning";

interface IncomeAveragesProps {
  averages: IncomeAverage[];
}

/**
 * Trailing-window income averages.
 *
 * Advisory only: these inform planning and "safe to pull" guidance. Buckets fund from actual
 * confirmed income, never from these figures.
 */
export default function IncomeAverages({ averages }: IncomeAveragesProps) {
  const [windowDays, setWindowDays] = useState(String(averages[0]?.windowDays ?? 90));
  const selected = averages.find((average) => String(average.windowDays) === windowDays) ?? averages[0];

  if (!selected) return null;

  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={600}>Average monthly income</Text>
          <SegmentedControl
            size="xs"
            value={windowDays}
            onChange={setWindowDays}
            data={averages.map((average) => ({ value: String(average.windowDays), label: `${average.windowDays}d` }))}
          />
        </Group>

        <Group align="flex-end" gap="lg">
          <div>
            <Text size="xs" c="dimmed">
              Net
            </Text>
            <Text size="xl" fw={700}>
              {formatCurrency(selected.monthlyNet)}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Gross
            </Text>
            <Text size="lg" fw={500}>
              {formatCurrency(selected.monthlyGross)}
            </Text>
          </div>
        </Group>

        {selected.partial && (
          <Tooltip
            multiline
            w={280}
            label={`Only ${selected.coverageDays} days of confirmed income exist, so this is averaged over that period rather than the full ${selected.windowDays} days.`}
          >
            <Badge color="yellow" variant="light" w="fit-content">
              Partial window — {selected.coverageDays} of {selected.windowDays} days
            </Badge>
          </Tooltip>
        )}

        <Text size="xs" c="dimmed">
          Advisory only — budget buckets are funded from confirmed income, not from this average.
        </Text>
      </Stack>
    </Card>
  );
}
