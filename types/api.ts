import { Decimal } from "@prisma/client/runtime/library";
/**
 * This file contains standardized types for API interactions.
 */

// Useful for responses where you only need to know the success of the action
export type ActionResult = { ok: true } | { ok: false; error: string };

// Extendable to any responses where data should be included
export type ResultData<T = void> = { ok: true; data: T } | { ok: false; error: string };

// Filtering operations available across different models
export type FilterOps<T> = T extends Date
  ? { before?: string; after?: string }
  : T extends number | Decimal
    ? { min?: number; max?: number }
    : T extends string
      ? { contains: string; eq?: string; in?: string[] }
      : { eq?: T };
