"use client";

import { useState, useMemo } from "react";
import GridLayout from "react-grid-layout";

type RGLItem = NonNullable<React.ComponentProps<typeof GridLayout>["layout"]>[number];
import { useElementSize } from "@mantine/hooks";
import { Paper, Text, Title, Stack, Button, Group } from "@mantine/core";
import { BarChart, DonutChart } from "@mantine/charts";
import { IconGripVertical, IconLayoutDashboard, IconCheck } from "@tabler/icons-react";
import StatsSegmentsExpenses from "./StatsSegmentsExpenses";
import ExpenseIncomeChart, { TIMEFRAMES, type Timeframe } from "./ExpenseIncomeChart";
import { sliceColorName } from "./chart-colors";
import type { CategorySlice, MonthTotal } from "../summary-db";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import classes from "./DashboardGrid.module.css";

const DEFAULT_LAYOUT = [
  { i: "expense-stats", x: 0, y: 0, w: 7, h: 5, minW: 3, minH: 2 },
  { i: "category-donut", x: 7, y: 0, w: 5, h: 5, minW: 3, minH: 2 },
  { i: "spending-trend", x: 0, y: 5, w: 12, h: 5, minW: 4, minH: 2 },
  { i: "expense-income", x: 0, y: 10, w: 12, h: 7, minW: 4, minH: 3 },
];

function cx(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

function WidgetCard({
  title,
  children,
  rearranging,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  rearranging: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <Paper p="md" h="100%" className={cx(classes.widget, rearranging && classes.widgetRearranging)}>
      <div className={classes.widgetHeader}>
        <div className={cx(classes.widgetTitleGroup, rearranging && "drag-handle")}>
          {rearranging && <IconGripVertical size={16} className={classes.gripIcon} />}
          <Text fw={600} size="sm" c="dimmed">
            {title}
          </Text>
        </div>
        {actions}
      </div>
      <div className={classes.widgetBody}>{children}</div>
    </Paper>
  );
}

function WidgetEmpty({ message = "No expenses yet" }: { message?: string }) {
  return (
    <div className={classes.widgetEmpty}>
      <Text size="sm" c="dimmed">
        {message}
      </Text>
    </div>
  );
}

type Props = {
  expenseStats: { total: number; segments: CategorySlice[]; deltaPct: number };
  categoryData: CategorySlice[];
  monthlyTrend: MonthTotal[];
  monthlyData: MonthTotal[];
  monthlyAssets: MonthTotal[];
};

const LAYOUT_STORAGE_KEY = "dashboard-layout";

function saveLayout(newLayout: RGLItem[]) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout));
  } catch {}
}

export default function DashboardGrid({ expenseStats, categoryData, monthlyTrend, monthlyData, monthlyAssets }: Props) {
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
  // Timeframe lives here because WidgetCard owns the header its toggle renders into.
  const [timeframe, setTimeframe] = useState<Timeframe>(6);
  const { ref, width } = useElementSize();

  const donutData = useMemo(
    () => categoryData.map((c, i) => ({ name: c.label, value: c.value, color: sliceColorName(i, c.label) })),
    [categoryData]
  );

  const barData = useMemo(() => monthlyTrend.map((m) => ({ month: m.month, Spending: m.total })), [monthlyTrend]);

  const lockedLayout = useMemo(() => layout.map((item) => ({ ...item, static: !rearranging })), [layout, rearranging]);

  const hasCategoryData = donutData.some((d) => d.value > 0);
  const hasTrendData = barData.some((d) => d.Spending > 0);
  const hasOverviewData = monthlyData.some((m) => m.total > 0) || monthlyAssets.some((m) => m.total > 0);

  const timeframeToggle = (
    <Group gap={4}>
      {TIMEFRAMES.map(({ label, value }) => (
        <Button
          key={value}
          size="compact-xs"
          variant={timeframe === value ? "filled" : "subtle"}
          onClick={() => setTimeframe(value)}
        >
          {label}
        </Button>
      ))}
    </Group>
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

      <div ref={ref} className={classes.gridShell}>
        {width > 0 && (
          <GridLayout
            layout={lockedLayout}
            onDragStop={(newLayout) => {
              setLayout(newLayout);
              saveLayout(newLayout);
            }}
            onResizeStop={(newLayout) => {
              setLayout(newLayout);
              saveLayout(newLayout);
            }}
            cols={12}
            rowHeight={42}
            width={width}
            draggableHandle=".drag-handle"
            isResizable={rearranging}
            margin={[12, 12]}
          >
            <div key="expense-stats">
              <WidgetCard title="This Month" rearranging={rearranging}>
                <StatsSegmentsExpenses {...expenseStats} />
              </WidgetCard>
            </div>

            <div key="category-donut">
              <WidgetCard title="Category Breakdown" rearranging={rearranging}>
                {hasCategoryData ? (
                  <DonutChart data={donutData} h="100%" tooltipDataSource="segment" withLabelsLine withLabels />
                ) : (
                  <WidgetEmpty />
                )}
              </WidgetCard>
            </div>

            <div key="spending-trend">
              <WidgetCard title={`${monthlyTrend.length}-Month Spending Trend`} rearranging={rearranging}>
                {hasTrendData ? (
                  <BarChart
                    h="100%"
                    data={barData}
                    dataKey="month"
                    series={[{ name: "Spending", color: "teal" }]}
                    tickLine="y"
                  />
                ) : (
                  <WidgetEmpty />
                )}
              </WidgetCard>
            </div>

            <div key="expense-income">
              <WidgetCard
                title="Monthly Overview"
                rearranging={rearranging}
                actions={hasOverviewData ? timeframeToggle : undefined}
              >
                {hasOverviewData ? (
                  <ExpenseIncomeChart monthlyData={monthlyData} monthlyAssets={monthlyAssets} timeframe={timeframe} />
                ) : (
                  <WidgetEmpty message="No expenses or assets yet" />
                )}
              </WidgetCard>
            </div>
          </GridLayout>
        )}
      </div>
    </Stack>
  );
}
