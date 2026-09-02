import * as z from "zod";
import type { BucketAllocationType } from "@prisma/client";

/** Budget bucket types. Money is `number` here; `Decimal` never crosses to the client. */

export const bucketAllocationTypeSchema = z.enum(["PERCENT", "FIXED"]);

export const NewBucketSchema = z
  .object({
    title: z.string().trim().min(1, "Name is required").max(32, "Name must be 32 characters or fewer"),
    description: z.string().trim().max(128).optional(),
    allocationType: bucketAllocationTypeSchema,
    /** Whole percent (25 = 25%) when PERCENT, dollars when FIXED. */
    allocationValue: z.number().nonnegative("Value cannot be negative"),
    /** Opt-in: an unspent balance carries into next month instead of resetting. */
    rollover: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.allocationType !== "PERCENT" || v.allocationValue <= 100, {
    message: "A percentage cannot exceed 100",
    path: ["allocationValue"],
  });
export type NewBucket = z.infer<typeof NewBucketSchema>;

export const UpdateBucketSchema = NewBucketSchema.safeExtend({ id: z.uuid() });
export type UpdateBucket = z.infer<typeof UpdateBucketSchema>;

/** How close a bucket is to empty. Yellow nearing zero, red overdrawn. */
export type BucketHealth = "ok" | "warning" | "overdrawn";

/**
 * A bucket plus its state for one month.
 *
 * `opening` is the stored rollover carry-in; `allocated` and `spent` are derived by summing
 * `BucketAllocation` and `Expense` rows, so no counter can drift from the underlying tables.
 */
export type BucketView = {
  id: string;
  title: string;
  description: string | null;
  allocationType: BucketAllocationType;
  allocationValue: number;
  rollover: boolean;
  sortOrder: number;
  isActive: boolean;
  periodStart: Date;
  opening: number;
  allocated: number;
  spent: number;
  /** opening + allocated - spent */
  available: number;
  /** opening + allocated — the denominator behind the progress bar */
  funded: number;
  health: BucketHealth;
};

/** A confirmed earning with net still unassigned to any bucket. */
export type UnallocatedEarningView = {
  earningId: string;
  title: string;
  date: Date;
  netAmount: number;
  allocated: number;
  remaining: number;
};

/** Client -> server payload: split one confirmed earning across buckets. */
export const AllocateEarningSchema = z.object({
  earningId: z.uuid(),
  allocations: z
    .array(z.object({ bucketId: z.uuid(), amount: z.number().nonnegative() }))
    .min(1, "Select at least one bucket"),
});
export type AllocateEarningInput = z.infer<typeof AllocateEarningSchema>;
