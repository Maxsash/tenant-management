export function formatCurrency(
  value: number | string
) {
  return `₹${Number(
    value || 0
  ).toLocaleString("en-IN")}`;
}
/**
 * Short form for chart labels and stat tiles, in Indian units: 3475 -> ₹3.5k,
 * 50331 -> ₹50k, 250000 -> ₹2.5L. Use formatCurrency wherever the exact
 * figure matters.
 */
export function formatCompactCurrency(value: number | string) {
  const amount = Number(value || 0);
  const size = Math.abs(amount);

  if (size >= 100000) {
    return `₹${(amount / 100000).toFixed(size >= 1000000 ? 0 : 1)}L`;
  }

  if (size >= 1000) {
    return `₹${(amount / 1000).toFixed(size >= 10000 ? 0 : 1)}k`;
  }

  return `₹${Math.round(amount)}`;
}

/** A signed percentage for a change, e.g. "+42.9%". */
export function formatDeltaPct(value: number) {
  return `${value > 0 ? "+" : ""}${value}%`;
}

/**
 * Count nouns that read wrong in the singular next to a number. Measurement
 * units (kg, L, g, ml, pcs) are deliberately absent — they do not inflect.
 */
const PLURAL_UNITS: Record<string, string> = {
  packet: "packets",
  pack: "packs",
  glass: "glasses",
  bottle: "bottles",
  box: "boxes",
  piece: "pieces",
  tin: "tins",
  jar: "jars",
  bag: "bags",
};

/** A measured amount with its unit, trimmed of pointless decimals. */
export function formatQuantity(value: number, unit: string | null) {
  const rounded = Math.round(value * 100) / 100;
  if (!unit) return String(rounded);

  const noun =
    rounded === 1 ? unit : (PLURAL_UNITS[unit.toLowerCase()] ?? unit);

  return `${rounded} ${noun}`;
}
