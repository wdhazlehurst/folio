"use server";

import { Title, Stack } from "@mantine/core";
import { getDashBoardSummary, getMonthTotals } from "./summary-db";
import StatsSegmentsExpenses from "./_widgets/StatsSegmentsExpenses";

export default async function DashboardLayout() {
  // month: true -> month-to-date; omit for all-time
  const [{ total, topBar }, { deltaPct }] = await Promise.all([getDashBoardSummary({ month: true }), getMonthTotals()]);

  return (
    <Stack>
      <Title>Dashboard</Title>
      <>
        <StatsSegmentsExpenses total={total} segments={topBar} deltaPct={deltaPct} />
      </>
    </Stack>
  );
}
