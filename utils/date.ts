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