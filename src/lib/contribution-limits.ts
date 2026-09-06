/**
 * Contribution limit and employer match rules.
 *
 * Pure: no database access, no Prisma client, no `Decimal` — the same reasoning as
 * `recurrence.ts`. The limit bar drawn in the UI and the check made when money is posted have to
 * agree, so both call this rather than each computing their own version.
 *
 * **No IRS figures live here.** The amounts change every year, and a stale constant that silently
 * looks authoritative is worse than no constant at all: the limits themselves are rows the owner
 * enters (`ContributionLimit`), and a year with no row reports "no limit set" rather than
 * assuming one. What this module encodes is the *structure* of the rules, which does not change
 * yearly — which accounts share a cap, what employer money counts against, and how a match is
 * computed.
 */

import { ContributionKind, ContributionLimitGroup, ContributionLimitVariant, HsaCoverage } from "@prisma/client";
import type { InvestmentAccountType } from "@prisma/client";

/**
 * Which annual cap each account type draws on.
 *
 * The two IRA types deliberately map to the **same** group. That is the rule people most often
 * get wrong: a Roth IRA and a Traditional IRA do not each get a full limit, they share one
 * between them, and treating them separately reports twice the room that actually exists.
 */
export const LIMIT_GROUP_BY_ACCOUNT_TYPE: Record<InvestmentAccountType, ContributionLimitGroup> = {
  ROTH_IRA: ContributionLimitGroup.IRA,
  TRADITIONAL_IRA: ContributionLimitGroup.IRA,
  FOUR_ZERO_ONE_K: ContributionLimitGroup.EMPLOYER_PLAN,
  HSA: ContributionLimitGroup.HSA,
  SAVINGS: ContributionLimitGroup.NONE,
  OTHER: ContributionLimitGroup.NONE,
};

/** Human labels for the groups, for the limits table and its warnings. */
export const LIMIT_GROUP_LABELS: Record<ContributionLimitGroup, string> = {
  IRA: "IRA (Roth + Traditional combined)",
  EMPLOYER_PLAN: "Employer plan (401k)",
  HSA: "HSA",
  NONE: "No annual limit",
};

export const LIMIT_VARIANT_LABELS: Record<ContributionLimitVariant, string> = {
  STANDARD: "Standard",
  HSA_SELF_ONLY: "Self-only coverage",
  HSA_FAMILY: "Family coverage",
};

/**
 * Which limit row an account uses. Only the HSA group varies, and it varies by coverage; an HSA
 * with no coverage recorded falls back to the self-only figure, which is the smaller of the two
 * and so errs toward warning early rather than late.
 */
export function limitVariantFor(
  group: ContributionLimitGroup,
  hsaCoverage: HsaCoverage | null
): ContributionLimitVariant {
  if (group !== ContributionLimitGroup.HSA) return ContributionLimitVariant.STANDARD;
  return hsaCoverage === HsaCoverage.FAMILY
    ? ContributionLimitVariant.HSA_FAMILY
    : ContributionLimitVariant.HSA_SELF_ONLY;
}

/**
 * Whether a contribution counts against the personal annual limit.
 *
 * Only your own money does. Employer match has its own separate cap, a rollover is money you
 * already had being moved, and a withdrawal does **not** hand back contribution room — taking
 * $1,000 out in June does not let you put $1,000 more in come December.
 */
export function countsTowardPersonalLimit(kind: ContributionKind): boolean {
  return kind === ContributionKind.EMPLOYEE;
}

/** Which direction a contribution moves the balance. Withdrawals are the only negative one. */
export function balanceDirection(kind: ContributionKind): 1 | -1 {
  return kind === ContributionKind.WITHDRAWAL ? -1 : 1;
}

/**
 * Whether posting this kind should also record an expense.
 *
 * Only your own money leaving your account is an expense. Employer match never touches your
 * account, a rollover moves money between accounts you already own, and a withdrawal is money
 * coming back **to** you — recording any of them as spending would overstate what you spent.
 */
export function writesExpense(kind: ContributionKind): boolean {
  return kind === ContributionKind.EMPLOYEE;
}

/** The employer match terms, as a plan states them. */
export type MatchTerms = {
  /** Percent of your contribution the employer adds. 50 means 50 cents per dollar. */
  matchPercent: number | null;
  /** They match only on pay up to this percent of salary. 6 means "up to 6% of pay". */
  matchLimitPercent: number | null;
  annualSalary: number | null;
};

export type MatchPlan = {
  /** True when the account has enough of a match configured to compute anything. */
  configured: boolean;
  /** What you must contribute across the year to earn every dollar of match available. */
  employeeContributionForFullMatch: number;
  /** The most the employer will add across the year. */
  maxAnnualMatch: number;
  /** `matchPercent` as a fraction, so per-contribution maths does not repeat the division. */
  matchPercentFraction: number;
};

/**
 * Turns "50% on up to 6% of pay" into dollars.
 *
 * Returns `configured: false` unless all three figures are present — a partly filled match is
 * not guessed at, because a wrong match figure would post real money into the balance.
 */
export function matchPlanFor(terms: MatchTerms): MatchPlan {
  const { matchPercent, matchLimitPercent, annualSalary } = terms;
  if (!matchPercent || !matchLimitPercent || !annualSalary) {
    return { configured: false, employeeContributionForFullMatch: 0, maxAnnualMatch: 0, matchPercentFraction: 0 };
  }

  const employeeContributionForFullMatch = roundCents(annualSalary * (matchLimitPercent / 100));
  return {
    configured: true,
    employeeContributionForFullMatch,
    maxAnnualMatch: roundCents(employeeContributionForFullMatch * (matchPercent / 100)),
    matchPercentFraction: matchPercent / 100,
  };
}

/**
 * The match earned on one contribution, given what the employer has already put in this year.
 *
 * Capped at what is left of the annual match, which is what makes a front-loaded year behave
 * correctly: once the employer has paid out its maximum, later contributions earn nothing more.
 */
export function matchForContribution(plan: MatchPlan, employeeAmount: number, matchPaidThisYear: number): number {
  if (!plan.configured || employeeAmount <= 0) return 0;
  const remaining = plan.maxAnnualMatch - matchPaidThisYear;
  if (remaining <= 0) return 0;
  return roundCents(Math.min(employeeAmount * plan.matchPercentFraction, remaining));
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
