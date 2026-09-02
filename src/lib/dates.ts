/**
 * UTC date helpers.
 *
 * Prisma `@db.Date` columns round-trip as JS `Date`s pinned to UTC midnight. Doing arithmetic
 * on them with the local-time accessors (`getMonth`, `setDate`, …) shifts the day by one for
 * anyone west of UTC, which silently moves pay dates and month boundaries. Every function here
 * works in UTC; use these rather than raw `Date` maths anywhere a `@db.Date` is involved.
 */

/** Milliseconds in a day. Safe for UTC arithmetic — UTC has no DST. */
const MS_PER_DAY = 86_400_000;

/** Strips any time component, returning UTC midnight of the same calendar day. */
export function toUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Today at UTC midnight. */
export function todayUtc(): Date {
  return toUtcDay(new Date());
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(toUtcDay(date).getTime() + days * MS_PER_DAY);
}

/** Whole days from `a` to `b`. Both are normalised first, so the result is exact. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((toUtcDay(b).getTime() - toUtcDay(a).getTime()) / MS_PER_DAY);
}

/** Number of days in a given UTC month. `month` is 0-indexed. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Adds months, clamping the day to the target month's length: 31 Jan + 1 month = 28 Feb.
 * Always measured from the original date, so 31 Jan + 2 months is 31 Mar, not 28 Mar.
 */
export function addMonthsUtcClamped(date: Date, months: number): Date {
  const base = toUtcDay(date);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + months;
  const target = new Date(Date.UTC(year, month, 1));
  const day = Math.min(base.getUTCDate(), daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day));
}

/** A specific day of a specific month, clamped to that month's length. */
export function dayOfMonthUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))));
}

/** First of the month containing `date` — the canonical `BucketPeriod.periodStart`. */
export function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** First of the following month; the exclusive upper bound of a budget period. */
export function nextMonthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** `YYYY-MM-DD`, used to key occurrences and exceptions by calendar day. */
export function dayKey(date: Date): string {
  return toUtcDay(date).toISOString().slice(0, 10);
}
