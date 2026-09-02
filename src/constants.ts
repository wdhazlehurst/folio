// Project-wide constants and configurations

export const DEFAULT_USER_ROLE = "USER";
export const ADMIN_USER_ROLE = "ADMIN";

export const INVALID_INPUT_ERROR = "Invalid input provided";

export const SALT_ROUNDS = 10;

export const DEFAULT_PAGINATION = 50;
export const MAX_PAGINATION = 1000;

// --- Phase 1: earnings + budget ---

/** How far ahead `/dashboard/earnings` projects unmaterialised occurrences. */
export const EARNINGS_PROJECTION_HORIZON_DAYS = 90;

/** Trailing windows for the advisory rolling income average. Days, not calendar months. */
export const ROLLING_AVERAGE_WINDOWS = [90, 180, 365] as const;

/** Average days per month (365.25 / 12) — normalises a trailing-day sum to a monthly figure. */
export const DAYS_PER_MONTH = 30.4375;

/**
 * The rolling average never divides by less than this, so a very short history cannot be
 * extrapolated into a wild monthly figure — one $2,250 paycheck on day one reads as $2,250/mo,
 * not $68,000/mo. Set to exactly one average month, which makes the short-history reading
 * "what you have actually received so far" with no residual inflation.
 */
export const MIN_AVERAGE_COVERAGE_DAYS = DAYS_PER_MONTH;

/** A bucket turns yellow once less than this fraction of its funded total is left. */
export const BUCKET_WARNING_RATIO = 0.2;
