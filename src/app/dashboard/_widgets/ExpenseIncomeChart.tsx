"use client";

import { useCallback, useMemo, useState } from "react";
import { VisXYContainer, VisArea, VisAxis, VisBulletLegend } from "@unovis/react";
import { CurveType } from "@unovis/ts";
import { Group, Button, Text, Paper } from "@mantine/core";
import type { MonthTotal } from "../summary-db";

type DataRecord = { month: string; expenses: number; income: number };

const TIMEFRAMES = [
  { label: "3M", value: 3 },
  { label: "6M", value: 6 },
  { label: "12M", value: 12 },
] as const;

type Timeframe = (typeof TIMEFRAMES)[number]["value"];

const legendItems = [
  { name: "Income", color: "#4dabf7" },
  { name: "Expenses", color: "#ff6b6b" },
];

// Stable module-level accessors — no closure over component state
const x = (_: DataRecord, i: number) => i;
const yExpenses = (d: DataRecord) => d.expenses;
const yIncome = (d: DataRecord) => d.income;

const fmt = Intl.NumberFormat("en", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 0 });
const yTickFormat = (tick: number | Date): string => fmt.format(tick as number);

type Props = { monthlyData: MonthTotal[] };

export default function ExpenseIncomeChart({ monthlyData }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>(6);

  const data = useMemo<DataRecord[]>(() => {
    return monthlyData.slice(-timeframe).map((m) => {
      // Deterministic mock income based on month label characters
      const seed = m.month.charCodeAt(0) + m.month.charCodeAt(m.month.length - 1);
      const multiplier = 1.25 + (seed % 55) / 100;
      return {
        month: m.month,
        expenses: m.total,
        income: Math.round(m.total * multiplier),
      };
    });
  }, [monthlyData, timeframe]);

  const xTickFormat = useCallback((tick: number | Date) => data[tick as number]?.month ?? "", [data]);

  return (
    <Paper p="md" h="100%" style={{ display: "flex", flexDirection: "column" }}>
      <Group justify="space-between" align="center" mb={4}>
        <Text fw={600} size="sm">
          Expenses vs Income
        </Text>
        <Group gap={4}>
          {TIMEFRAMES.map(({ label, value }) => (
            <Button
              key={value}
              size="compact-xs"
              variant={timeframe === value ? "filled" : "subtle"}
              color="blue"
              onClick={() => setTimeframe(value)}
            >
              {label}
            </Button>
          ))}
        </Group>
      </Group>

      <VisBulletLegend items={legendItems} />

      <VisXYContainer data={data} style={{ flex: 1, minHeight: 0 }}>
        <VisArea
          x={x}
          y={yIncome}
          color="#4dabf7"
          opacity={0.5}
          curveType={CurveType.Basis}
        />
        <VisArea
          x={x}
          y={yExpenses}
          color="#ff6b6b"
          opacity={0.65}
          curveType={CurveType.Basis}
        />
        <VisAxis type="x" tickFormat={xTickFormat} />
        <VisAxis type="y" tickFormat={yTickFormat} />
      </VisXYContainer>
    </Paper>
  );
}
