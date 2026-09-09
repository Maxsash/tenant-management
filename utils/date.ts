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

export function formatMonthYear(
  date: string
) {
  return new Date(
    date
  ).toLocaleDateString("en-IN", {
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
