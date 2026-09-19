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

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Month arithmetic on "YYYY-MM" without touching Date, so no timezone drift. */
export function addMonths(month: string, delta: number): string {
  if (!MONTH_RE.test(month)) return month;

  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + delta;
  const shiftedYear = year + Math.floor(index / 12);
  const shiftedMonth = ((index % 12) + 12) % 12;

  return `${shiftedYear}-${String(shiftedMonth + 1).padStart(2, "0")}`;
}

/** Every month from `from` to `to`, inclusive. */
export function monthRange(from: string, to: string): string[] {
  if (!MONTH_RE.test(from) || !MONTH_RE.test(to) || from > to) return [];

  const months: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);

  return months;
}

/** Whole days from one "YYYY-MM-DD" to another; negative when `to` is earlier.
 *  Counted in UTC so a daylight-saving shift can't make a day 23 hours. */
export function daysBetween(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);

  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86_400_000
  );
}

/** "YYYY-MM-DD" moved by whole days, either way. In UTC, like daysBetween,
 *  so the two always agree: daysBetween(d, addDays(d, n)) === n. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" on the same day some whole months later, held to the last day
 *  of a shorter month: 31 January plus one month is 28 (or 29) February. */
export function addCalendarMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}
