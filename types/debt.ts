import * as z from "zod";
import type { PostingStatus } from "@prisma/client";

/**
 * Debt types. Money is `number` on every type here: `Decimal` is converted with `.toNumber()`
 * in the server action and never crosses to the client.
 */

const moneySchema = z.number().nonnegative("Amount cannot be negative").max(9_999_999_999.99, "Amount is too large");

/** Whole percent, matching how `BudgetBucket.allocationValue` stores one. 24.99 means 24.99% APR. */
const rateSchema = z
  .number()
  .nonnegative("Interest rate cannot be negative")
  .max(99.9999, "Interest rate must be under 100%");

/** Client -> server payload for creating or editing a debt. */
export const NewDebtSchema = z
  .object({
    title: z.string().trim().min(1, "Name is required").max(32, "Name must be 32 characters or fewer"),
    description: z.string().trim().max(256).optional(),
    balance: moneySchema,
    /** Annual rate as a whole percent. No maths uses it yet — it is here for the payoff work. */
    interestRate: rateSchema,
    minimumPayment: moneySchema,
    /** What will actually be paid. Allowed to sit below the minimum; the UI flags it. */
    paymentAmount: moneySchema,
    /** First payment date; every later payment falls on the same day of the month. */
    anchorDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
    /** Bucket the generated expense is charged to. */
    bucketId: z.uuid().nullable().optional(),
    /** Expense category the generated expense is filed under. */
    categoryId: z.uuid().nullable().optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.anchorDate, {
    message: "End date cannot be before the first payment date",
    path: ["endDate"],
  })
  .refine((v) => v.paymentAmount > 0, { message: "A payment must be more than zero", path: ["paymentAmount"] });
export type NewDebt = z.infer<typeof NewDebtSchema>;

export const UpdateDebtSchema = NewDebtSchema.safeExtend({ id: z.uuid() });
export type UpdateDebt = z.infer<typeof UpdateDebtSchema>;

/** Client -> server payload for a manually recorded payment (an extra or catch-up payment). */
export const RecordDebtPaymentSchema = z.object({
  debtId: z.uuid(),
  amount: moneySchema,
  date: z.coerce.date(),
});
export type RecordDebtPaymentInput = z.infer<typeof RecordDebtPaymentSchema>;

/** Client -> server payload for overriding or skipping one future payment. */
export const DebtPaymentExceptionSchema = z
  .object({
    debtId: z.uuid(),
    scheduledDate: z.coerce.date(),
    action: z.enum(["SKIP", "OVERRIDE"]),
    overrideDate: z.coerce.date().nullable().optional(),
    overrideAmount: moneySchema.nullable().optional(),
  })
  .refine((v) => v.action !== "OVERRIDE" || v.overrideDate != null || v.overrideAmount != null, {
    message: "An override must change the date or the amount",
  });
export type DebtPaymentExceptionInput = z.infer<typeof DebtPaymentExceptionSchema>;

/** A debt as returned to the client. */
export type DebtView = {
  id: string;
  title: string;
  description: string | null;
  balance: number;
  /** Whole percent — 24.99 is 24.99% APR. */
  interestRate: number;
  minimumPayment: number;
  paymentAmount: number;
  anchorDate: Date;
  endDate: Date | null;
  isActive: boolean;
  bucketId: string | null;
  bucketTitle: string | null;
  categoryId: string | null;
  categoryTitle: string | null;
  /** The next payment the schedule will post, or null once the balance is cleared. */
  nextPaymentDate: Date | null;
  /** What that payment would be, capped at the remaining balance. */
  nextPaymentAmount: number | null;
  /** True when the set payment is below what the lender requires. */
  belowMinimum: boolean;
  /** True when the balance is cleared, so nothing further will post. */
  paidOff: boolean;
};

/** A materialised `DebtPayment` row as returned to the client. */
export type DebtPaymentView = {
  id: string;
  amount: number;
  date: Date;
  scheduledDate: Date | null;
  status: PostingStatus;
  debtId: string | null;
  debtTitle: string | null;
  /** The expense this payment generated, if it still exists. */
  expenseId: string | null;
};

/**
 * A future payment. Computed from the debt on every request and never stored — which is why it
 * has no `id`. Amounts are capped by a running balance, so the schedule stops at payoff rather
 * than projecting payments that would never be made.
 */
export type ProjectedDebtPaymentView = {
  debtId: string;
  debtTitle: string;
  scheduledDate: Date;
  date: Date;
  amount: number;
  /** The debt's balance after this payment, on the projection's own running total. */
  balanceAfter: number;
  skipped: boolean;
  overridden: boolean;
};

/**
 * Totals for the debts page, and the figure net worth (Assets + Investments − Debts) will read.
 * Nothing computes net worth yet; this just makes the balance available.
 */
export type DebtSummary = {
  /** Sum of every active debt's balance. */
  totalBalance: number;
  /** Sum of the set payments of active, unpaid debts — the monthly commitment. */
  monthlyCommitment: number;
  debtCount: number;
};
