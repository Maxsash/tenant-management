export function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * `part` as a whole-number percentage of `whole`, or null when there is no
 * whole to speak of. Never rounds up to 100 or down to 0 unless it really is
 * all or nothing — "100% collected" beside a rupee still owed reads as a bug.
 */
export function percentOf(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  if (part >= whole) return 100;
  if (part <= 0) return 0;

  return Math.min(99, Math.max(1, Math.round((part / whole) * 100)));
}
