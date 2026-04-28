"use client";

import { useCallback, useMemo, useState } from "react";
import { VisXYContainer, VisArea, VisAxis, VisBulletLegend } from "@unovis/react";
import { CurveType } from "@unovis/ts";
import { Group, Button, Text, Paper } from "@mantine/core";
import type { MonthTotal } from "../summary-db";

type DataRecord = { month: string; expenses: number; assets: number };

const TIMEFRAMES = [
  { label: "3M", value: 3 },
  { label: "6M", value: 6 },
  { label: "12M", value: 12 },
] as const;

type Timeframe = (typeof TIMEFRAMES)[number]["value"];

const legendItems = [
  { name: "Expenses", color: "#ff6b6b" },
  { name: "Assets", color: "#69db7c" },
];

// Stable module-level accessors — no closure over component state
const x = (_: DataRecord, i: number) => i;
const yExpenses = (d: DataRecord) => d.expenses;
const yAssets = (d: DataRecord) => d.assets;

const fmt = Intl.NumberFormat("en", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 0 });
const yTickFormat = (tick: number | Date): string => fmt.format(tick as number);

type Props = { monthlyData: MonthTotal[]; monthlyAssets: MonthTotal[] };

export default function ExpenseIncomeChart({ monthlyData, monthlyAssets }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>(6);

  const data = useMemo<DataRecord[]>(() => {
    return monthlyData.slice(-timeframe).map((m) => {
      const assetEntry = monthlyAssets.find((a) => a.month === m.month);
      return {
        month: m.month,
        expenses: m.total,
        assets: assetEntry?.total ?? 0,
      };
    });
  }, [monthlyData, monthlyAssets, timeframe]);

  const xTickFormat = useCallback((tick: number | Date) => data[tick as number]?.month ?? "", [data]);

  return (
    <Paper p="md" h="100%" style={{ display: "flex", flexDirection: "column" }}>
      <Group justify="space-between" align="center" mb={4}>
        <Text fw={600} size="sm">
          Monthly Overview
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
        <VisArea x={x} y={yExpenses} color="#ff6b6b" opacity={0.65} curveType={CurveType.Basis} />
        <VisArea x={x} y={yAssets} color="#69db7c" opacity={0.6} curveType={CurveType.Basis} />
        <VisAxis type="x" tickFormat={xTickFormat} />
        <VisAxis type="y" tickFormat={yTickFormat} />
      </VisXYContainer>
    </Paper>
  );
}
