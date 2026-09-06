import * as z from "zod";
import type {
  ContributionKind,
  ContributionLimitGroup,
  ContributionLimitVariant,
  EarningFrequency,
  HsaCoverage,
  InvestmentAccountType,
  PostingStatus,
} from "@prisma/client";

/**
 * Investment types. Money is `number` on every type here: `Decimal` is converted with
 * `.toNumber()` in the server action and never crosses to the client.
 */

const moneySchema = z.number().nonnegative("Amount cannot be negative").max(9_999_999_999.99, "Amount is too large");

/** The account types, in the order they are shown. Labels are display-only. */
export const ACCOUNT_TYPE_LABELS: Record<InvestmentAccountType, string> = {
  HSA: "HSA",
  ROTH_IRA: "Roth IRA",
  TRADITIONAL_IRA: "Traditional IRA",
  FOUR_ZERO_ONE_K: "401(k)",
  SAVINGS: "Savings",
  OTHER: "Other",
};

export const ACCOUNT_TYPE_ORDER = [
  "HSA",
  "ROTH_IRA",
  "TRADITIONAL_IRA",
  "FOUR_ZERO_ONE_K",
  "SAVINGS",
  "OTHER",
] as const satisfies readonly InvestmentAccountType[];

/** Client -> server payload for creating or editing an account. */
export const NewInvestmentSchema = z
  .object({
    title: z.string().trim().min(1, "Name is required").max(32, "Name must be 32 characters or fewer"),
    description: z.string().trim().max(256).optional(),
    accountType: z.enum(["HSA", "ROTH_IRA", "TRADITIONAL_IRA", "FOUR_ZERO_ONE_K", "SAVINGS", "OTHER"]),
    institution: z.string().trim().max(64).optional(),
    balance: moneySchema,
    /** Zero is valid — an account can be tracked for its balance alone. */
    contributionAmount: moneySchema,
    frequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]),
    /** First contribution date; later ones step from it. */
    anchorDate: z.coerce.date(),
    /** SEMI_MONTHLY only — the month's second contribution day. */
    secondDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
    /** Expected annual return as a whole percent. Stored for projections; nothing compounds it. */
    assumedReturnRate: z.number().min(-100, "A return under -100% is not possible").max(99.9999).nullable().optional(),
    /** HSA only — the family cap is roughly double the self-only one. */
    hsaCoverage: z.enum(["SELF_ONLY", "FAMILY"]).nullable().optional(),
    /** Employer match: `matchPercent` of your contribution, on up to `limitPercent` of pay. */
    employerMatchPercent: z.number().nonnegative().max(999.9999).nullable().optional(),
    employerMatchLimitPercent: z.number().nonnegative().max(100).nullable().optional(),
    annualSalary: moneySchema.nullable().optional(),
    /**
     * Set only when the contribution leaves the checking account. Setting either one makes a
     * posted contribution write an `Expense`; leaving both null (a pre-tax deferral) writes none.
     */
    bucketId: z.uuid().nullable().optional(),
    categoryId: z.uuid().nullable().optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.anchorDate, {
    message: "End date cannot be before the first contribution date",
    path: ["endDate"],
  });
export type NewInvestment = z.infer<typeof NewInvestmentSchema>;

export const UpdateInvestmentSchema = NewInvestmentSchema.safeExtend({ id: z.uuid() });
export type UpdateInvestment = z.infer<typeof UpdateInvestmentSchema>;

/** Client -> server payload for a contribution made outside the schedule. */
export const RecordContributionSchema = z.object({
  investmentId: z.uuid(),
  amount: moneySchema.refine((v) => v > 0, "A contribution must be more than zero"),
  date: z.coerce.date(),
});
export type RecordContributionInput = z.infer<typeof RecordContributionSchema>;

/**
 * Client -> server payload for correcting a balance — how market growth, interest and fees get
 * in, since none of those flow through a contribution.
 */
export const RecordBalanceSchema = z.object({
  investmentId: z.uuid(),
  balance: moneySchema,
  date: z.coerce.date(),
});
export type RecordBalanceInput = z.infer<typeof RecordBalanceSchema>;

/** Client -> server payload for overriding or skipping one future contribution. */
export const ContributionExceptionSchema = z
  .object({
    investmentId: z.uuid(),
    scheduledDate: z.coerce.date(),
    action: z.enum(["SKIP", "OVERRIDE"]),
    overrideDate: z.coerce.date().nullable().optional(),
    overrideAmount: moneySchema.nullable().optional(),
  })
  .refine((v) => v.action !== "OVERRIDE" || v.overrideDate != null || v.overrideAmount != null, {
    message: "An override must change the date or the amount",
  });
export type ContributionExceptionInput = z.infer<typeof ContributionExceptionSchema>;

/** An account as returned to the client. */
export type InvestmentView = {
  id: string;
  title: string;
  description: string | null;
  accountType: InvestmentAccountType;
  institution: string | null;
  balance: number;
  contributionAmount: number;
  frequency: EarningFrequency;
  anchorDate: Date;
  secondDayOfMonth: number | null;
  endDate: Date | null;
  isActive: boolean;
  bucketId: string | null;
  bucketTitle: string | null;
  categoryId: string | null;
  categoryTitle: string | null;
  /** The next contribution the schedule will post, or null when nothing is scheduled. */
  nextContributionDate: Date | null;
  nextContributionAmount: number | null;
  /**
   * True when a posted contribution writes an expense — i.e. the money leaves the checking
   * account. False for a pre-tax deferral, which has neither bucket nor category.
   */
  fundedFromAccount: boolean;
  assumedReturnRate: number | null;
  hsaCoverage: HsaCoverage | null;
  employerMatchPercent: number | null;
  employerMatchLimitPercent: number | null;
  annualSalary: number | null;
  /** Which annual cap this account draws on, derived from its type. */
  limitGroup: ContributionLimitGroup;
  /** What the employer will add across the year at most, or null when no match is configured. */
  maxAnnualMatch: number | null;
  /** What you must put in across the year to collect all of it. */
  contributionForFullMatch: number | null;
  /** Your own contributions to this account so far this calendar year. */
  employeeContributedThisYear: number;
  /** Employer money into this account so far this calendar year. */
  employerContributedThisYear: number;
  /**
   * True when this year's pace will not reach the full match — the "you are leaving money on the
   * table" flag. Null when no match is configured.
   */
  belowMatchThreshold: boolean | null;
  /** The most recent snapshot date, so the UI can say how stale the balance is. */
  lastSnapshotDate: Date | null;
};

/** A materialised `InvestmentContribution` row as returned to the client. */
export type ContributionView = {
  id: string;
  amount: number;
  kind: ContributionKind;
  date: Date;
  scheduledDate: Date | null;
  status: PostingStatus;
  investmentId: string | null;
  investmentTitle: string | null;
  /** The expense this contribution generated, if one was written and still exists. */
  expenseId: string | null;
};

/**
 * A future contribution. Computed from the account on every request and never stored — which is
 * why it has no `id`. Unlike a debt payment there is no cap: nothing bounds how much can go in.
 */
export type ProjectedContributionView = {
  investmentId: string;
  investmentTitle: string;
  scheduledDate: Date;
  date: Date;
  amount: number;
  /** The account's balance after this contribution, on the projection's own running total. */
  balanceAfter: number;
  skipped: boolean;
  overridden: boolean;
};

/** One day's recorded balance for one account. */
export type InvestmentSnapshotView = {
  investmentId: string;
  date: Date;
  balance: number;
};

/** Totals for the investments page. */
export type InvestmentSummary = {
  /** Sum of every account's balance — the figure net worth adds. */
  totalBalance: number;
  /** Contributions scheduled per month across active accounts, normalised by frequency. */
  monthlyContribution: number;
  accountCount: number;
  /** Balance per account type, for the page header breakdown. */
  byType: { accountType: InvestmentAccountType; label: string; balance: number }[];
};

/** Client -> server payload for a withdrawal. Money coming out, not going in. */
export const RecordWithdrawalSchema = z.object({
  investmentId: z.uuid(),
  amount: moneySchema.refine((v) => v > 0, "A withdrawal must be more than zero"),
  date: z.coerce.date(),
});
export type RecordWithdrawalInput = z.infer<typeof RecordWithdrawalSchema>;

/** Client -> server payload for a rollover in from another account. */
export const RecordRolloverSchema = z.object({
  investmentId: z.uuid(),
  amount: moneySchema.refine((v) => v > 0, "A rollover must be more than zero"),
  date: z.coerce.date(),
});
export type RecordRolloverInput = z.infer<typeof RecordRolloverSchema>;

/**
 * Client -> server payload for correcting a posted contribution.
 *
 * The manual override for a figure that has already moved money: changing it reconciles the
 * account balance and any linked expense by the difference, rather than leaving them behind.
 */
export const UpdateContributionSchema = z.object({
  id: z.uuid(),
  amount: moneySchema.refine((v) => v > 0, "An amount must be more than zero"),
  date: z.coerce.date(),
});
export type UpdateContributionInput = z.infer<typeof UpdateContributionSchema>;

/** Client -> server payload for one year's cap for one group. */
export const ContributionLimitSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  group: z.enum(["IRA", "EMPLOYER_PLAN", "HSA", "NONE"]),
  variant: z.enum(["STANDARD", "HSA_SELF_ONLY", "HSA_FAMILY"]).optional(),
  limit: moneySchema,
  totalAdditionsLimit: moneySchema.nullable().optional(),
  /** Signed: positive for money paid in elsewhere, negative to correct an overcount. */
  contributedAdjustment: z.number().min(-9_999_999_999.99).max(9_999_999_999.99).optional(),
});
export type ContributionLimitInput = z.infer<typeof ContributionLimitSchema>;

/** A limit row as returned to the client. */
export type ContributionLimitView = {
  id: string;
  year: number;
  group: ContributionLimitGroup;
  variant: ContributionLimitVariant;
  limit: number;
  totalAdditionsLimit: number | null;
  contributedAdjustment: number;
};

/** How much of one group's annual room has been used. */
export type ContributionUsage = {
  group: ContributionLimitGroup;
  variant: ContributionLimitVariant;
  label: string;
  year: number;
  /** Null when no limit row exists for this year — never a guessed figure. */
  limit: number | null;
  totalAdditionsLimit: number | null;
  /** Your own contributions, plus the manual adjustment. */
  contributed: number;
  /** Employer money, which has its own cap and does not consume your personal room. */
  employerContributed: number;
  /** Rollovers in. Counted against nothing; shown so the numbers reconcile. */
  rollovers: number;
  /** Signed manual correction included in `contributed`. */
  adjustment: number;
  /** `limit - contributed`, or null when no limit is set. */
  remaining: number | null;
  /** ok | warning (within 10%) | over. `unknown` when no limit is set for the year. */
  status: "ok" | "warning" | "over" | "unknown";
  /** True when employee + employer money exceeds the combined cap, where one applies. */
  overTotalAdditions: boolean;
};
