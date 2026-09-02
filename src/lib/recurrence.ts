/**
 * Occurrence expansion for recurring rules.
 *
 * Pure: no database access, no Prisma client, no `Decimal`. This is deliberate — exactly one
 * implementation serves all three consumers, so a projection shown in the UI and a row written
 * by the materialiser can never disagree about when a rule fires.
 *
 *   projection        today → today + horizon   computed, never written
 *   materialisation   watermark → today         written as `Earning` rows (status PROJECTED)
 *   catch-up checker  same as materialisation   a later feature; needs no new logic
 *
 * Phase 2's debt payment schedule reuses this module rather than reimplementing it.
 */

import { EarningFrequency, OccurrenceExceptionAction } from "@prisma/client";
import { addDaysUtc, addMonthsUtcClamped, dayKey, dayOfMonthUtc, toUtcDay } from "./dates";

/**
 * How far past the requested window slots are still generated, so that an exception which pulls
 * an occurrence *earlier* into the window is not missed. Occurrences are filtered afterwards on
 * their effective date, not their slot.
 */
const SLOT_LOOKAHEAD_DAYS = 62;

/** Guards against a malformed rule (e.g. a corrupt anchor) spinning forever. */
const MAX_SLOTS = 10_000;

/** The rule fields expansion needs. Structural, so callers can pass a Prisma row or a draft. */
export type RecurrenceRule = {
  frequency: EarningFrequency;
  anchorDate: Date;
  secondDayOfMonth: number | null;
  endDate: Date | null;
  isActive: boolean;
  grossAmount: number;
  netAmount: number;
};

/** One override/skip, keyed by the slot it applies to. */
export type RecurrenceException = {
  scheduledDate: Date;
  action: OccurrenceExceptionAction;
  overrideDate: Date | null;
  overrideGross: number | null;
  overrideNet: number | null;
};

export type Occurrence = {
  /** Slot identity, as the rule would generate it. Stable even when an override moves `date`. */
  scheduledDate: Date;
  /** The date the money is expected to land, after any override. */
  date: Date;
  grossAmount: number;
  netAmount: number;
  /** True when an exception skips this slot. Kept in the result so the UI can offer an un-skip. */
  skipped: boolean;
  /** True when an exception changed the date or the amounts. */
  overridden: boolean;
};

/**
 * Every slot the rule fires on, from its anchor up to and including `until`.
 * Ignores exceptions — `expandOccurrences` layers those on top.
 */
function generateSlots(rule: RecurrenceRule, until: Date): Date[] {
  const anchor = toUtcDay(rule.anchorDate);
  const limit = rule.endDate && toUtcDay(rule.endDate) < until ? toUtcDay(rule.endDate) : toUtcDay(until);
  if (limit < anchor) return [];

  const slots: Date[] = [];

  if (rule.frequency === EarningFrequency.WEEKLY || rule.frequency === EarningFrequency.BIWEEKLY) {
    const step = rule.frequency === EarningFrequency.WEEKLY ? 7 : 14;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = addDaysUtc(anchor, i * step);
      if (slot > limit) break;
      slots.push(slot);
    }
    return slots;
  }

  if (rule.frequency === EarningFrequency.MONTHLY) {
    // Measured from the anchor every time, so a 31st anchor gives 28 Feb but still 31 Mar.
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = addMonthsUtcClamped(anchor, i);
      if (slot > limit) break;
      slots.push(slot);
    }
    return slots;
  }

  // SEMI_MONTHLY: two fixed days each month — the anchor's day, plus `secondDayOfMonth`.
  // A missing second day degrades to monthly rather than throwing.
  const dayA = anchor.getUTCDate();
  const dayB = rule.secondDayOfMonth ?? dayA;
  const [firstDay, secondDay] = dayA <= dayB ? [dayA, dayB] : [dayB, dayA];

  for (let i = 0; i < MAX_SLOTS; i++) {
    const month = addMonthsUtcClamped(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)), i);
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();

    const candidates =
      firstDay === secondDay
        ? [dayOfMonthUtc(year, monthIndex, firstDay)]
        : [dayOfMonthUtc(year, monthIndex, firstDay), dayOfMonthUtc(year, monthIndex, secondDay)];

    let pastLimit = false;
    for (const slot of candidates) {
      if (slot < anchor) continue; // the rule starts at its anchor, not at the month's first pay day
      if (slot > limit) {
        pastLimit = true;
        break;
      }
      slots.push(slot);
    }
    if (pastLimit) break;
  }
  return slots;
}

/**
 * Occurrences of `rule` whose effective date falls in `[from, to]`, with `exceptions` applied.
 *
 * An inactive rule yields nothing — pausing a rule stops both projection and materialisation
 * without touching income already posted.
 */
export function expandOccurrences(
  rule: RecurrenceRule,
  exceptions: readonly RecurrenceException[],
  from: Date,
  to: Date
): Occurrence[] {
  if (!rule.isActive) return [];

  const exceptionsBySlot = new Map(exceptions.map((e) => [dayKey(e.scheduledDate), e]));
  const windowStart = toUtcDay(from);
  const windowEnd = toUtcDay(to);

  const occurrences: Occurrence[] = [];

  for (const scheduledDate of generateSlots(rule, addDaysUtc(windowEnd, SLOT_LOOKAHEAD_DAYS))) {
    const exception = exceptionsBySlot.get(dayKey(scheduledDate));

    const skipped = exception?.action === OccurrenceExceptionAction.SKIP;
    const override = exception?.action === OccurrenceExceptionAction.OVERRIDE ? exception : undefined;

    const date = override?.overrideDate ? toUtcDay(override.overrideDate) : scheduledDate;
    if (date < windowStart || date > windowEnd) continue;

    occurrences.push({
      scheduledDate,
      date,
      grossAmount: override?.overrideGross ?? rule.grossAmount,
      netAmount: override?.overrideNet ?? rule.netAmount,
      skipped,
      overridden: override !== undefined,
    });
  }

  return occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Human label for a frequency, for tables and selects. */
export const FREQUENCY_LABELS: Record<EarningFrequency, string> = {
  [EarningFrequency.WEEKLY]: "Weekly",
  [EarningFrequency.BIWEEKLY]: "Every 2 weeks",
  [EarningFrequency.SEMI_MONTHLY]: "Twice a month",
  [EarningFrequency.MONTHLY]: "Monthly",
};
