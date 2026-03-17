/**
 * This file contains standardized types for API interactions.
 */

// Useful for responses where you only need to know the success of the action
export type ActionResult = { ok: true } | { ok: false; error: string };

// Extendable to any responses where data should be included
export type ResultData<T = void> = { ok: true; data: T } | { ok: false; error: string };

type ExpenseFilter<T> = {
  before?: T extends Date | string ? string : never;
  after?: T extends Date | string ? string : never;
  amountMin?: T extends string ? string : never;
  amountMax?: T extends string ? string : never;
  categoryId?: T extends string ? string : never;
};

export type QueryInput = {
  filters?: Record<string, ExpenseFilter<any>>;
  sort?: Record<string, "asc" | "desc">;
  select?: string[];
  pagination: {
    count?: number;
    page?: number;
  };
};
