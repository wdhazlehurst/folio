/**
 * The single palette for every dashboard widget.
 *
 * Two parallel forms of the same colours:
 * - `CHART_COLOR_NAMES` — Mantine colour names, for components that resolve them
 *   themselves (`DonutChart`, `BarChart`, `Progress.Section`, `Text c=`).
 * - `CHART_COLORS_CSS` — the matching Mantine CSS variables, for libraries that
 *   want a raw CSS colour (Unovis). Using the variable rather than a hex is what
 *   makes those charts follow the light/dark colour scheme.
 */
export const CHART_COLOR_NAMES = ["teal", "grape", "blue", "orange", "cyan", "yellow"] as const;

export const CHART_COLORS_CSS = CHART_COLOR_NAMES.map((name) => `var(--mantine-color-${name}-5)`);

/** Aggregated "Others" slice — deliberately muted so it reads as a remainder. */
export const OTHERS_COLOR_NAME = "gray";

/** Spending vs. holdings. Red/green carries meaning here, so it sits outside the rotation. */
export const EXPENSE_COLOR = "var(--mantine-color-red-5)";
export const ASSET_COLOR = "var(--mantine-color-teal-5)";

/** Colour of the unsaved-change dot in the editable tables. */
export const DIRTY_COLOR = "var(--mantine-color-yellow-6)";

/** Pick a palette colour for slice `index`, keeping "Others" muted. */
export function sliceColorName(index: number, label?: string): string {
  if (label === "Others") return OTHERS_COLOR_NAME;
  return CHART_COLOR_NAMES[index % CHART_COLOR_NAMES.length];
}
