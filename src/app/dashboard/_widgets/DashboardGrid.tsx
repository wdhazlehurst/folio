"use client";

import { useState, useMemo } from "react";
import GridLayout from "react-grid-layout";

type RGLItem = NonNullable<React.ComponentProps<typeof GridLayout>["layout"]>[number];
import { useElementSize } from "@mantine/hooks";
import { Paper, Text, Title, Stack, Button, Group } from "@mantine/core";
import { BarChart, DonutChart } from "@mantine/charts";
import { IconGripVertical, IconLayoutDashboard, IconCheck } from "@tabler/icons-react";
import StatsSegmentsExpenses from "./StatsSegmentsExpenses";
import ExpenseIncomeChart from "./ExpenseIncomeChart";
import type { CategorySlice, MonthTotal } from "../summary-db";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import classes from "./DashboardGrid.module.css";

const DEFAULT_LAYOUT = [
  { i: "expense-stats",   x: 0, y: 0,  w: 7,  h: 5, minW: 3, minH: 2 },
  { i: "category-donut", x: 7, y: 0,  w: 5,  h: 5, minW: 3, minH: 2 },
  { i: "spending-trend", x: 0, y: 5,  w: 12, h: 5, minW: 4, minH: 2 },
  { i: "expense-income", x: 0, y: 10, w: 12, h: 7, minW: 4, minH: 3 },
];

const CHART_COLORS = ["teal", "grape", "blue", "orange", "cyan", "red", "yellow"];

function WidgetCard({
  title,
  children,
  rearranging,
}: {
  title: string;
  children: React.ReactNode;
  rearranging: boolean;
}) {
  return (
    <Paper
      p="md"
      h="100%"
      style={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        border: rearranging ? "1.5px dashed var(--mantine-color-default-border)" : "1px solid var(--mantine-color-default-border)",
      }}
    >
      {rearranging && (
        <div
          className="drag-handle"
          style={{ cursor: "grab", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}
        >
          <IconGripVertical size={16} color="var(--mantine-color-dimmed)" />
          <Text fw={600} size="sm" c="dimmed">
            {title}
          </Text>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </Paper>
  );
}

type Props = {
  expenseStats: { total: number; segments: CategorySlice[]; deltaPct: number };
  categoryData: CategorySlice[];
  monthlyTrend: MonthTotal[];
  monthlyData: MonthTotal[];
};

const LAYOUT_STORAGE_KEY = "dashboard-layout";

function saveLayout(newLayout: RGLItem[]) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout));
  } catch {}
}

export default function DashboardGrid({ expenseStats, categoryData, monthlyTrend, monthlyData }: Props) {
  const [layout, setLayout] = useState<RGLItem[]>(() => {
    if (typeof window === "undefined") return DEFAULT_LAYOUT;
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
    } catch {
      return DEFAULT_LAYOUT;
    }
  });
  const [rearranging, setRearranging] = useState(false);
  const { ref, width } = useElementSize();

  const donutData = useMemo(
    () => categoryData.map((c, i) => ({ name: c.label, value: c.value, color: CHART_COLORS[i % CHART_COLORS.length] })),
    [categoryData]
  );

  const barData = useMemo(
    () => monthlyTrend.map((m) => ({ month: m.month, Spending: m.total })),
    [monthlyTrend]
  );

  const lockedLayout = useMemo(
    () => layout.map((item) => ({ ...item, static: !rearranging })),
    [layout, rearranging]
  );

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Title order={2}>Dashboard</Title>
        <Button
          variant={rearranging ? "filled" : "light"}
          color={rearranging ? "teal" : "gray"}
          size="xs"
          leftSection={rearranging ? <IconCheck size={14} /> : <IconLayoutDashboard size={14} />}
          onClick={() => setRearranging((r) => !r)}
        >
          {rearranging ? "Done" : "Rearrange"}
        </Button>
      </Group>

      <div ref={ref}>
        <GridLayout
          layout={lockedLayout}
          onDragStop={(newLayout) => { setLayout(newLayout); saveLayout(newLayout); }}
          onResizeStop={(newLayout) => { setLayout(newLayout); saveLayout(newLayout); }}
          cols={12}
          rowHeight={42}
          width={width || 1200}
          draggableHandle=".drag-handle"
          isResizable={rearranging}
          margin={[12, 12]}
        >
          <div key="expense-stats">
            <Paper
              p="md"
              h="100%"
              style={{
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: rearranging ? "1.5px dashed var(--mantine-color-default-border)" : "1px solid var(--mantine-color-default-border)",
              }}
            >
              {rearranging && (
                <div
                  className="drag-handle"
                  style={{ cursor: "grab", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}
                >
                  <IconGripVertical size={16} color="var(--mantine-color-dimmed)" />
                  <Text fw={600} size="sm" c="dimmed">
                    This Month
                  </Text>
                </div>
              )}
              <StatsSegmentsExpenses {...expenseStats} />
            </Paper>
          </div>

          <div key="category-donut">
            <WidgetCard title="Category Breakdown" rearranging={rearranging}>
              <DonutChart
                data={donutData}
                h="100%"
                tooltipDataSource="segment"
                withLabelsLine
                withLabels
              />
            </WidgetCard>
          </div>

          <div key="spending-trend">
            <WidgetCard title="6-Month Spending Trend" rearranging={rearranging}>
              <BarChart
                h="100%"
                data={barData}
                dataKey="month"
                series={[{ name: "Spending", color: "teal" }]}
                tickLine="y"
              />
            </WidgetCard>
          </div>

          <div key="expense-income">
            <WidgetCard title="Expenses vs Income" rearranging={rearranging}>
              <ExpenseIncomeChart monthlyData={monthlyData} />
            </WidgetCard>
          </div>
        </GridLayout>
      </div>
    </Stack>
  );
}
