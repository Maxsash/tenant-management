/**
 * Unit normalisation.
 *
 * The catalogue settled on four canonical units — kg, L, pcs, packet — after
 * an import pass had to rewrite every gram row into kilos because the same
 * vegetable had been logged both ways (see
 * scripts/import-slips-2026-07-to-09.sql, step 1). Consumption analytics can
 * only sum a column of numbers that share a unit, so anything entering the
 * app from a slip goes through here first rather than being stored as typed.
 */

export const CANONICAL_UNITS = ["kg", "L", "pcs", "packet"] as const;

export type CanonicalUnit = (typeof CANONICAL_UNITS)[number];

export interface Measure {
  quantity: number | null;
  unit: string | null;
}

/**
 * Spellings seen on the slips and in the existing catalogue, mapped to the
 * canonical unit and the factor to multiply the written quantity by.
 * Hinglish spellings are included deliberately — the slips are handwritten
 * Hindi, and "kilo"/"nag"/"packet" all show up.
 */
const ALIASES: Record<string, { unit: CanonicalUnit; factor: number }> = {
  // mass
  kg: { unit: "kg", factor: 1 },
  kgs: { unit: "kg", factor: 1 },
  kilo: { unit: "kg", factor: 1 },
  kilos: { unit: "kg", factor: 1 },
  kilogram: { unit: "kg", factor: 1 },
  kilograms: { unit: "kg", factor: 1 },
  g: { unit: "kg", factor: 0.001 },
  gm: { unit: "kg", factor: 0.001 },
  gms: { unit: "kg", factor: 0.001 },
  gram: { unit: "kg", factor: 0.001 },
  grams: { unit: "kg", factor: 0.001 },

  // volume
  l: { unit: "L", factor: 1 },
  ltr: { unit: "L", factor: 1 },
  litre: { unit: "L", factor: 1 },
  litres: { unit: "L", factor: 1 },
  liter: { unit: "L", factor: 1 },
  liters: { unit: "L", factor: 1 },
  ml: { unit: "L", factor: 0.001 },

  // count
  pc: { unit: "pcs", factor: 1 },
  pcs: { unit: "pcs", factor: 1 },
  piece: { unit: "pcs", factor: 1 },
  pieces: { unit: "pcs", factor: 1 },
  nag: { unit: "pcs", factor: 1 },
  no: { unit: "pcs", factor: 1 },
  nos: { unit: "pcs", factor: 1 },
  dozen: { unit: "pcs", factor: 12 },

  // packaging
  packet: { unit: "packet", factor: 1 },
  packets: { unit: "packet", factor: 1 },
  pkt: { unit: "packet", factor: 1 },
  pack: { unit: "packet", factor: 1 },
  packs: { unit: "packet", factor: 1 },
};

/** Rounds off the float dust that dividing by 1000 leaves behind. */
function tidy(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Rewrites a written quantity+unit into canonical form: 500 g becomes 0.5 kg,
 * a dozen becomes 12 pcs.
 *
 * An unrecognised unit is passed through untouched rather than dropped — a
 * slip may legitimately say something we have no rule for, and losing it
 * silently would be worse than storing it as written.
 */
export function normalizeMeasure(
  quantity: number | null | undefined,
  unit: string | null | undefined
): Measure {
  const rawUnit = typeof unit === "string" ? unit.trim() : "";
  const numericQuantity =
    typeof quantity === "number" && Number.isFinite(quantity) ? quantity : null;

  if (!rawUnit) {
    return { quantity: numericQuantity, unit: null };
  }

  const alias = ALIASES[rawUnit.toLowerCase().replace(/[.\s]/g, "")];

  if (!alias) {
    return { quantity: numericQuantity, unit: rawUnit };
  }

  return {
    quantity:
      numericQuantity === null ? null : tidy(numericQuantity * alias.factor),
    unit: alias.unit,
  };
}

/**
 * True when two units mean the same thing once normalised, so a catalogue
 * default of "kg" against a slip's "500 g" does not read as a mismatch.
 * Two unrecognised units are compared case-insensitively as plain strings.
 */
export function unitsAgree(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizeMeasure(null, a).unit;
  const right = normalizeMeasure(null, b).unit;

  if (left === null || right === null) return left === right;

  return left.toLowerCase() === right.toLowerCase();
}
