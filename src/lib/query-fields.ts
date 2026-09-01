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

export const EXPENSE_QUERY_FIELDS = ["title", "description", "amount", "date", "categoryId"] as const;
export type ExpenseQueryField = (typeof EXPENSE_QUERY_FIELDS)[number];

export const ASSET_QUERY_FIELDS = ["title", "amount", "isCash", "date", "categoryId"] as const;
export type AssetQueryField = (typeof ASSET_QUERY_FIELDS)[number];

export const EXPENSE_CATEGORY_QUERY_FIELDS = ["title", "description", "createdAt", "updatedAt"] as const;
export type ExpenseCategoryQueryField = (typeof EXPENSE_CATEGORY_QUERY_FIELDS)[number];

export const ASSET_CATEGORY_QUERY_FIELDS = ["title", "description", "createdAt", "updatedAt"] as const;
export type AssetCategoryQueryField = (typeof ASSET_CATEGORY_QUERY_FIELDS)[number];
