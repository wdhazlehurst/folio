import { getDashBoardSummary, getMonthTotals, getMonthlyTrend, getMonthlyAssetTrend } from "./summary-db";
import DashboardGridClient from "./_widgets/DashboardGridClient";

export default async function DashboardPage() {
  // Two separate trends on purpose: the bar widget shows 6 months, while the
  // Monthly Overview chart needs the full 12 so its 3M/6M/12M toggle has data.
  const [{ total, topBar, categories }, { deltaPct }, monthlyTrend, monthlyData, monthlyAssets] = await Promise.all([
    getDashBoardSummary({ month: true }),
    getMonthTotals(),
    getMonthlyTrend(6),
    getMonthlyTrend(12),
    getMonthlyAssetTrend(12),
  ]);

  return (
    <DashboardGridClient
      expenseStats={{ total, segments: topBar, deltaPct }}
      categoryData={categories}
      monthlyTrend={monthlyTrend}
      monthlyData={monthlyData}
      monthlyAssets={monthlyAssets}
    />
  );
}
