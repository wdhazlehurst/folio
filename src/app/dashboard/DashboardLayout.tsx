"use server";

import { Title, Stack } from "@mantine/core";
import { getDashBoardSummary } from "./summary-db";
import StatsSegmentsExpenses from "./_widgets/StatsSegmentsExpenses";

export default async function DashboardLayout() {
  // month: true -> month-to-date; omit for all-time
  const { total, topBar, categories } = await getDashBoardSummary({ month: true });

  return (
    <Stack>
      <Title>Dashboard</Title>
    <>
      <StatsSegmentsExpenses total={total} segments={topBar} />
    </>
    </Stack>
  );

};