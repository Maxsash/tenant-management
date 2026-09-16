export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True for a real "YYYY-MM" month. Routes check this before handing a
 *  client-supplied month to anything that formats it. */
export function isValidMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;

  const index = Number(value.slice(5));
  return index >= 1 && index <= 12;
}

/** True for a real "YYYY-MM-DD" calendar date — rejects "2026-02-30", which
 *  `new Date()` would quietly roll over into March. */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
