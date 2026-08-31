"use client";

import { useCallback, useMemo } from "react";
import { VisXYContainer, VisArea, VisAxis, VisBulletLegend } from "@unovis/react";
import { CurveType } from "@unovis/ts";
import { Box } from "@mantine/core";
import { EXPENSE_COLOR, ASSET_COLOR } from "./chart-colors";
import type { MonthTotal } from "../summary-db";

type DataRecord = { month: string; expenses: number; assets: number };

export const TIMEFRAMES = [
  { label: "3M", value: 3 },
  { label: "6M", value: 6 },
  { label: "12M", value: 12 },
] as const;

export type Timeframe = (typeof TIMEFRAMES)[number]["value"];

const legendItems = [
  { name: "Expenses", color: EXPENSE_COLOR },
  { name: "Assets", color: ASSET_COLOR },
];

// Stable module-level accessors — no closure over component state
const x = (_: DataRecord, i: number) => i;
const yExpenses = (d: DataRecord) => d.expenses;
const yAssets = (d: DataRecord) => d.assets;

const fmt = Intl.NumberFormat("en", {
  notation: "compact",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const yTickFormat = (tick: number | Date): string => fmt.format(tick as number);

type Props = { monthlyData: MonthTotal[]; monthlyAssets: MonthTotal[]; timeframe: Timeframe };

export default function ExpenseIncomeChart({ monthlyData, monthlyAssets, timeframe }: Props) {
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
    <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
      <VisBulletLegend items={legendItems} />

      <VisXYContainer data={data} style={{ flex: 1, minHeight: 0 }}>
        <VisArea x={x} y={yExpenses} color={EXPENSE_COLOR} opacity={0.65} curveType={CurveType.Basis} />
        <VisArea x={x} y={yAssets} color={ASSET_COLOR} opacity={0.6} curveType={CurveType.Basis} />
        <VisAxis type="x" tickFormat={xTickFormat} />
        <VisAxis type="y" tickFormat={yTickFormat} />
      </VisXYContainer>
    </Box>
  );
}
