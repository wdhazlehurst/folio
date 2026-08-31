"use client";

// app/dashboard/_widgets/StatsSegmentsExpenses.tsx

import { Box, Group, Progress, SimpleGrid, Text } from "@mantine/core";
import classes from "./StatsSegmentsExpenses.module.css";
import { IconArrowUpRight, IconArrowDownRight } from "@tabler/icons-react";
import { sliceColorName } from "./chart-colors";

type Segment = {
  label: string; // category name
  value: number; // category amount
  percent: number; // percent
};

const fmtMoney = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default function StatsSegmentsExpenses({
  total,
  segments,
  deltaPct,
  title = "Total spent",
  subtitle = "Percent by Category",
}: {
  total: number;
  segments: Segment[]; // expected to be your topBar from summary-db
  deltaPct?: number;
  title?: string;
  subtitle?: string;
}) {
  // Build progress sections from your percentages
  const progressSections = segments.map((s, i) => ({
    value: Math.max(0, Math.min(100, Number(s.percent.toFixed(2)))),
    color: sliceColorName(i, s.label),
    key: `${s.label}-${i}`,
  }));

  // Display rows under the bar
  const descriptions = segments.map((s, i) => (
    <Box
      key={s.label}
      style={{ borderBottomColor: `var(--mantine-color-${sliceColorName(i, s.label)}-6)` }}
      className={classes.stat}
    >
      <Text tt="uppercase" fz="xs" c="dimmed" fw={700}>
        {s.label}
      </Text>
      <Group justify="space-between" align="flex-end" gap={0}>
        <Text fw={700}>{fmtMoney.format(s.value)}</Text>
        <Text c={sliceColorName(i, s.label)} fw={700} fz="sm" className={classes.statCount}>
          {s.percent.toFixed(1)}%
        </Text>
      </Group>
    </Box>
  ));

  const isUp = (deltaPct ?? 0) >= 0;
  const DeltaIcon = isUp ? IconArrowUpRight : IconArrowDownRight;
  const deltaColor = isUp ? "red" : "teal";
  const deltaWay = isUp ? "increase" : "decrease";
  const deltaLabel =
    deltaPct == null ? null : (
      <Text c={deltaColor} fz="sm" fw={700} className={classes.statCount}>
        <span>
          {Math.abs(deltaPct).toFixed(0)}% {deltaWay} compared to last month
        </span>
        <DeltaIcon size={16} style={{ marginLeft: 4, marginBottom: 2 }} stroke={1.5} />
      </Text>
    );

  return (
    <Box h="100%">
      <Group justify="space-between" mb="xs">
        <Group align="flex-end" gap="xs">
          <div>
            <Text fz="sm" c="dimmed">
              {title}
            </Text>
            <Text fz="xl" fw={700}>
              {fmtMoney.format(total)}
            </Text>
          </div>
        </Group>
        {deltaLabel}
      </Group>

      <Text c="dimmed" fz="sm">
        {subtitle}
      </Text>

      {segments.length > 0 ? (
        <>
          <Progress.Root size={34} classNames={{ label: classes.progressLabel }} mt={30}>
            {progressSections.map((sec, idx) => (
              <Progress.Section key={sec.key} value={sec.value} color={sec.color}>
                {sec.value > 10 && <Progress.Label>{segments[idx].percent.toFixed(0)}%</Progress.Label>}
              </Progress.Section>
            ))}
          </Progress.Root>

          <SimpleGrid cols={{ base: 1, xs: 3 }} mt="xl">
            {descriptions}
          </SimpleGrid>
        </>
      ) : (
        <Text size="sm" c="dimmed" mt="xl">
          No expenses recorded this month.
        </Text>
      )}
    </Box>
  );
}
