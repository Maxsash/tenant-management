// utils/date.ts

export function formatDate(
  date: string
) {
  return new Date(date).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
    }
  );
}