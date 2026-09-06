/**
 * Per-model field allowlists for the generic query layer.
 *
 * `QuerySerializer` validates every incoming `filters`/`sort` key against one of these, so a
 * client can only ever reach the columns listed here — arbitrary field names never make it into
 * Prisma's `where`/`orderBy`. Add a field here (and only here) to make it queryable.
 *
 * Scalars only: `parseFilters` maps flat operators onto columns and has no notion of relations,
 * so `category` (a relation) is filtered via its scalar `categoryId`.
 */

export const EXPENSE_QUERY_FIELDS = ["title", "description", "amount", "date", "categoryId", "bucketId"] as const;
export type ExpenseQueryField = (typeof EXPENSE_QUERY_FIELDS)[number];

export const ASSET_QUERY_FIELDS = ["title", "amount", "isCash", "date", "categoryId"] as const;
export type AssetQueryField = (typeof ASSET_QUERY_FIELDS)[number];

export const EXPENSE_CATEGORY_QUERY_FIELDS = ["title", "description", "createdAt", "updatedAt"] as const;
export type ExpenseCategoryQueryField = (typeof EXPENSE_CATEGORY_QUERY_FIELDS)[number];

export const ASSET_CATEGORY_QUERY_FIELDS = ["title", "description", "createdAt", "updatedAt"] as const;
export type AssetCategoryQueryField = (typeof ASSET_CATEGORY_QUERY_FIELDS)[number];

export const EARNING_QUERY_FIELDS = [
  "title",
  "description",
  "grossAmount",
  "netAmount",
  "date",
  "status",
  "ruleId",
] as const;
export type EarningQueryField = (typeof EARNING_QUERY_FIELDS)[number];

export const EARNING_RULE_QUERY_FIELDS = ["title", "frequency", "anchorDate", "isActive"] as const;
export type EarningRuleQueryField = (typeof EARNING_RULE_QUERY_FIELDS)[number];

export const BUDGET_BUCKET_QUERY_FIELDS = ["title", "allocationType", "rollover", "isActive"] as const;
export type BudgetBucketQueryField = (typeof BUDGET_BUCKET_QUERY_FIELDS)[number];

export const DEBT_QUERY_FIELDS = [
  "title",
  "description",
  "balance",
  "interestRate",
  "minimumPayment",
  "paymentAmount",
  "anchorDate",
  "isActive",
  "bucketId",
  "categoryId",
] as const;
export type DebtQueryField = (typeof DEBT_QUERY_FIELDS)[number];

export const DEBT_PAYMENT_QUERY_FIELDS = ["amount", "date", "status", "debtId"] as const;
export type DebtPaymentQueryField = (typeof DEBT_PAYMENT_QUERY_FIELDS)[number];

export const INVESTMENT_QUERY_FIELDS = [
  "title",
  "description",
  "accountType",
  "institution",
  "balance",
  "contributionAmount",
  "frequency",
  "anchorDate",
  "isActive",
  "bucketId",
  "categoryId",
] as const;
export type InvestmentQueryField = (typeof INVESTMENT_QUERY_FIELDS)[number];

export const INVESTMENT_CONTRIBUTION_QUERY_FIELDS = ["amount", "date", "status", "investmentId"] as const;
export type InvestmentContributionQueryField = (typeof INVESTMENT_CONTRIBUTION_QUERY_FIELDS)[number];
