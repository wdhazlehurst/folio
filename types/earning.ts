import * as z from "zod";
import type { EarningFrequency, OccurrenceExceptionAction, PostingStatus } from "@prisma/client";

/**
 * Earnings types. Money is `number` on every type here: `Decimal` is converted with
 * `.toNumber()` in the server action and never crosses to the client.
 */

export const earningFrequencySchema = z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]);
export const postingStatusSchema = z.enum(["PROJECTED", "CONFIRMED", "CANCELLED"]);

const moneySchema = z.number().nonnegative("Amount cannot be negative").max(9_999_999_999.99, "Amount is too large");

/** Client -> server payload for creating or editing a recurring income rule. */
export const NewEarningRuleSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(32, "Title must be 32 characters or fewer"),
    description: z.string().trim().max(256).optional(),
    grossAmount: moneySchema,
    netAmount: moneySchema,
    frequency: earningFrequencySchema,
    /** The date the money hits the account, not the period worked. */
    anchorDate: z.coerce.date(),
    secondDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.netAmount <= v.grossAmount, {
    message: "Net cannot exceed gross",
    path: ["netAmount"],
  })
  .refine((v) => v.frequency !== "SEMI_MONTHLY" || v.secondDayOfMonth != null, {
    message: "A second pay day is required for twice-monthly income",
    path: ["secondDayOfMonth"],
  })
  .refine((v) => !v.endDate || v.endDate >= v.anchorDate, {
    message: "End date cannot be before the first pay date",
    path: ["endDate"],
  });
export type NewEarningRule = z.infer<typeof NewEarningRuleSchema>;

/** Client -> server payload for a standalone or backdated earning. */
export const NewEarningSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(32, "Title must be 32 characters or fewer"),
    description: z.string().trim().max(256).optional(),
    grossAmount: moneySchema,
    netAmount: moneySchema,
    date: z.coerce.date(),
    /** Backdated entries are typically already verified, so the caller may confirm on create. */
    status: postingStatusSchema.optional(),
  })
  .refine((v) => v.netAmount <= v.grossAmount, { message: "Net cannot exceed gross", path: ["netAmount"] });
export type NewEarning = z.infer<typeof NewEarningSchema>;

export const UpdateEarningSchema = NewEarningSchema.safeExtend({ id: z.uuid() });
export type UpdateEarning = z.infer<typeof UpdateEarningSchema>;

/** A rule as returned to the client. */
export type EarningRuleView = {
  id: string;
  title: string;
  description: string | null;
  grossAmount: number;
  netAmount: number;
  frequency: EarningFrequency;
  anchorDate: Date;
  secondDayOfMonth: number | null;
  endDate: Date | null;
  isActive: boolean;
  lastMaterializedThrough: Date | null;
};

/** A materialised `Earning` row as returned to the client. */
export type EarningView = {
  id: string;
  title: string;
  description: string | null;
  grossAmount: number;
  netAmount: number;
  date: Date;
  scheduledDate: Date | null;
  status: PostingStatus;
  ruleId: string | null;
  ruleTitle: string | null;
  /** Net already assigned to buckets. Only ever non-zero for CONFIRMED rows. */
  allocatedAmount: number;
};

/**
 * A future occurrence. Computed from the rule on every request and never stored — which is why
 * it has no `id` and cannot be allocated to a bucket.
 */
export type ProjectedOccurrenceView = {
  ruleId: string;
  ruleTitle: string;
  scheduledDate: Date;
  date: Date;
  grossAmount: number;
  netAmount: number;
  skipped: boolean;
  overridden: boolean;
};

/** Client -> server payload for overriding or skipping one future occurrence. */
export const OccurrenceExceptionSchema = z
  .object({
    ruleId: z.uuid(),
    scheduledDate: z.coerce.date(),
    action: z.enum(["SKIP", "OVERRIDE"]),
    overrideDate: z.coerce.date().nullable().optional(),
    overrideGross: moneySchema.nullable().optional(),
    overrideNet: moneySchema.nullable().optional(),
  })
  .refine(
    (v) => v.action !== "OVERRIDE" || v.overrideDate != null || v.overrideGross != null || v.overrideNet != null,
    { message: "An override must change the date or an amount" }
  );
export type OccurrenceExceptionInput = z.infer<typeof OccurrenceExceptionSchema>;
export type { OccurrenceExceptionAction };

/**
 * One trailing-window average. Advisory only — this drives planning and "safe to pull" guidance
 * and is never an input to bucket funding.
 */
export type IncomeAverage = {
  windowDays: number;
  /** Confirmed net in the window, normalised to a monthly figure. */
  monthlyNet: number;
  monthlyGross: number;
  /** True when history is shorter than the window, so the figure is over a partial window. */
  partial: boolean;
  /** Days of history actually covered — the number behind the "partial" label. */
  coverageDays: number;
};
