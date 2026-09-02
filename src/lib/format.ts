/** Display formatting shared by the dashboard pages. */

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCurrency(value: number): string {
  return currency.format(value);
}

/**
 * Formats a `@db.Date` column for display.
 *
 * Those values come back pinned to UTC midnight, so formatting them in the browser's local zone
 * renders the *previous* day for anyone west of UTC. Always format them in UTC.
 */
const day = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDay(value: Date | string): string {
  return day.format(typeof value === "string" ? new Date(value) : value);
}

/** `YYYY-MM-DD` in UTC — the value shape Mantine's date inputs use. */
export function toDateInputValue(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}
