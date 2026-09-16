export function formatShortDate(
  date: string
) {
  return new Date(
    date
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function formatFullDate(
  date: string
) {
  return new Date(
    date
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "2026-08" -> "Aug". Built from parts rather than parsed, so a timezone
 *  behind UTC can't roll the label back to the previous month. */
export function formatMonthShort(month: string) {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;

  return new Date(year, index - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
  });
}

/** "2026-08" -> "August 2026", for the same reason. */
export function formatMonthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;

  return new Date(year, index - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/** "2026-08" -> "Aug ’26", for axis labels on a window spanning years. The
 *  apostrophe keeps it from reading as the 26th of August. */
export function formatMonthShortYear(month: string) {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;

  return `${formatMonthShort(month)} ’${String(year % 100).padStart(2, "0")}`;
}

/** "2026-08" -> "Aug 2026", for running text where a month is named in
 *  passing. */
export function formatMonthCompact(month: string) {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;

  return `${formatMonthShort(month)} ${year}`;
}

/** 6 -> "6th". */
export function formatOrdinal(value: number) {
  const tens = value % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[value % 10] ?? "th";

  return `${value}${suffix}`;
}

/**
 * When rent usually arrives, from a pay day counted from the 1st of the month
 * it is paid in (see lib/rent-analytics.ts#payDay): "by the 6th".
 */
export function formatPayDay(day: number) {
  if (day <= 0) return "in advance";
  if (day > 31) return "into the month after";
  return `by the ${formatOrdinal(day)}`;
}

/** The same, short enough for a stat tile under "Usually paid by": "6th". */
export function formatPayDayShort(day: number) {
  if (day <= 0) return "Advance";
  if (day > 31) return "Next month";
  return formatOrdinal(day);
}
