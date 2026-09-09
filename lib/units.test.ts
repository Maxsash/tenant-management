import { describe, expect, it } from "vitest";
import { normalizeMeasure, unitsAgree } from "@/lib/units";

describe("normalizeMeasure", () => {
  it("converts grams to kilos, the split that forced the July import rewrite", () => {
    expect(normalizeMeasure(500, "g")).toEqual({ quantity: 0.5, unit: "kg" });
    expect(normalizeMeasure(250, "gm")).toEqual({ quantity: 0.25, unit: "kg" });
    expect(normalizeMeasure(1500, "grams")).toEqual({ quantity: 1.5, unit: "kg" });
  });

  it("converts millilitres to litres", () => {
    expect(normalizeMeasure(750, "ml")).toEqual({ quantity: 0.75, unit: "L" });
  });

  it("counts a dozen as twelve pieces", () => {
    expect(normalizeMeasure(1, "dozen")).toEqual({ quantity: 12, unit: "pcs" });
    expect(normalizeMeasure(2, "dozen")).toEqual({ quantity: 24, unit: "pcs" });
  });

  it("folds the spellings of a unit onto one canonical form", () => {
    for (const spelling of ["kg", "KG", "Kgs", "kilo", "kilos", " kg "]) {
      expect(normalizeMeasure(3, spelling).unit).toBe("kg");
    }

    for (const spelling of ["l", "L", "ltr", "litre", "Liters"]) {
      expect(normalizeMeasure(1, spelling).unit).toBe("L");
    }

    for (const spelling of ["pc", "pcs", "piece", "pieces", "nag", "nos"]) {
      expect(normalizeMeasure(4, spelling).unit).toBe("pcs");
    }

    for (const spelling of ["packet", "pkt", "pack", "packs"]) {
      expect(normalizeMeasure(1, spelling).unit).toBe("packet");
    }
  });

  it("passes an unrecognised unit through rather than dropping it", () => {
    expect(normalizeMeasure(2, "bori")).toEqual({ quantity: 2, unit: "bori" });
  });

  it("treats a blank unit as no unit", () => {
    expect(normalizeMeasure(2, "")).toEqual({ quantity: 2, unit: null });
    expect(normalizeMeasure(2, null)).toEqual({ quantity: 2, unit: null });
    expect(normalizeMeasure(2, "   ")).toEqual({ quantity: 2, unit: null });
  });

  it("keeps a unit when there is no quantity to go with it", () => {
    expect(normalizeMeasure(null, "kg")).toEqual({ quantity: null, unit: "kg" });
  });

  it("rejects a non-finite quantity instead of storing NaN", () => {
    expect(normalizeMeasure(Number.NaN, "kg").quantity).toBeNull();
    expect(normalizeMeasure(Number.POSITIVE_INFINITY, "kg").quantity).toBeNull();
  });

  it("rounds away the float dust from dividing by a thousand", () => {
    expect(normalizeMeasure(1, "g")).toEqual({ quantity: 0.001, unit: "kg" });
    expect(normalizeMeasure(333, "g")).toEqual({ quantity: 0.333, unit: "kg" });
  });
});

describe("unitsAgree", () => {
  it("sees grams and kilos as the same measure", () => {
    expect(unitsAgree("g", "kg")).toBe(true);
    expect(unitsAgree("ml", "L")).toBe(true);
  });

  it("separates measures that are genuinely different", () => {
    expect(unitsAgree("kg", "pcs")).toBe(false);
    expect(unitsAgree("L", "packet")).toBe(false);
  });

  it("compares two unrecognised units case-insensitively", () => {
    expect(unitsAgree("bori", "BORI")).toBe(true);
    expect(unitsAgree("bori", "gaddi")).toBe(false);
  });

  it("treats absent units as agreeing only with each other", () => {
    expect(unitsAgree(null, null)).toBe(true);
    expect(unitsAgree(null, "kg")).toBe(false);
    expect(unitsAgree("kg", "")).toBe(false);
  });
});
