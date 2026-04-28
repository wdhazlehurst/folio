import { getDashBoardSummary, getMonthTotals, getMonthlyTrend, getMonthlyAssetTrend } from "./summary-db";
import DashboardGridClient from "./_widgets/DashboardGridClient";

export default async function DashboardPage() {
  const [{ total, topBar, categories }, { deltaPct }, monthlyTrend, monthlyAssets] = await Promise.all([
    getDashBoardSummary({ month: true }),
    getMonthTotals(),
    getMonthlyTrend(12),
    getMonthlyAssetTrend(12),
  ]);

  return (
    <DashboardGridClient
      expenseStats={{ total, segments: topBar, deltaPct }}
      categoryData={categories}
      monthlyTrend={monthlyTrend}
      monthlyData={monthlyTrend}
      monthlyAssets={monthlyAssets}
    />
  );
}

