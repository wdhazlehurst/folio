import { getDashBoardSummary, getMonthTotals, getMonthlyTrend } from "./summary-db";
import DashboardGrid from "./_widgets/DashboardGrid";

export default async function DashboardPage() {
  const [{ total, topBar, categories }, { deltaPct }, monthlyTrend] = await Promise.all([
    getDashBoardSummary({ month: true }),
    getMonthTotals(),
    getMonthlyTrend(12),
  ]);

  return (
    <DashboardGrid
      expenseStats={{ total, segments: topBar, deltaPct }}
      categoryData={categories}
      monthlyTrend={monthlyTrend}
      monthlyData={monthlyTrend}
    />
  );
}
