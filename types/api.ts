import type { Decimal } from "@prisma/client/runtime/library";
/**
 * This file contains standardized types for API interactions.
 */

// Useful for responses where you only need to know the success of the action
export type ActionResult = { ok: true } | { ok: false; error: string };

// Extendable to any responses where data should be included
export type ResultData<T = void> = { ok: true; data: T } | { ok: false; error: string };

// Filtering operations available across different models.
// This is the single definition — src/lib/schemas.ts used to carry a second, divergent copy.
export type FilterOps<T> = T extends Date
  ? { before?: string; after?: string }
  : T extends number | Decimal
    ? { min?: number; max?: number }
    : T extends string
      ? { contains?: string; eq?: string; in?: string[] }
      : { eq?: T };

export type SortDirection = "asc" | "desc";

export type Pagination = { limit?: number; page?: number };

/**
 * Client -> Server query description for a single model. `filters` and `sort` keys are
 * constrained to `keyof T`; the runtime allowlist that mirrors this lives in
 * `src/lib/query-fields.ts` and is enforced by `QuerySerializer`.
 */
export type QueryInput<T> = {
  filters?: { [K in keyof T]?: FilterOps<T[K]> };
  sort?: { [K in keyof T]?: SortDirection };
  pagination?: Pagination;
};

/** Paginated read result returned by `getModelData`. */
export type PagedResult<T> = {
  data: T[];
  meta: {
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
