import { describe, expect, it } from "vitest";
import {
  buildConsumptionTable,
  listMeasurableCategories,
} from "./consumption-table";
import type { ItemSeries } from "@/types/expense";

function makeItem(overrides: Partial<ItemSeries> = {}): ItemSeries {
  return {
    key: "item-1",
    name: "Aaloo",
    category: "Vegetables & Fruits",
    unit: "kg",
    mixedUnits: false,
    amounts: [60, 40],
    quantities: [4, 2],
    rates: [15, 20],
    pricedAmounts: [60, 40],
    pricedQuantities: [4, 2],
    entries: [1, 1],
    ...overrides,
  };
}

/** Every row priced and weighed, which is the ordinary case. */
function measured(overrides: Partial<ItemSeries> & {
  quantities: (number | null)[];
  amounts: number[];
}): ItemSeries {
  return makeItem({
    ...overrides,
    pricedQuantities: overrides.quantities.map((q) => q ?? 0),
    pricedAmounts: overrides.amounts,
  });
}

const onion = measured({
  key: "onion",
  name: "Pyaaz",
  quantities: [7, 3],
  amounts: [260, 120],
  rates: [37.14, 40],
});

const potato = measured({
  key: "potato",
  name: "Aaloo",
  quantities: [12, 6],
  amounts: [180, 100],
  rates: [15, 16.67],
});

const lemon = measured({
  key: "lemon",
  name: "Nimbu",
  unit: "pcs",
  quantities: [4, null],
  amounts: [10, 0],
  rates: [2.5, null],
});

describe("listMeasurableCategories", () => {
  it("reports each category with the unit its table would use", () => {
    const result = listMeasurableCategories([potato, onion, lemon]);

    expect(result).toEqual([
      {
        category: "Vegetables & Fruits",
        unit: "kg",
        itemCount: 2,
        spend: 660,
        coherence: 0.667,
      },
    ]);
  });

  it("prefers the category one unit actually describes over the richer one", () => {
    // Groceries outspends the vegetables many times over, but is measured in
    // four different units, so its single-unit table would mostly be a list of
    // what it left out.
    const groceries = [
      measured({ key: "kaaju", name: "Kaaju", category: "Groceries",
        quantities: [1, 1], amounts: [3000, 3000] }),
      measured({ key: "maggi", name: "Maggi", category: "Groceries",
        unit: "pack", quantities: [3, 2], amounts: [160, 110] }),
      measured({ key: "oil", name: "Sarso ka tel", category: "Groceries",
        unit: "L", quantities: [1, 1], amounts: [190, 190] }),
      measured({ key: "vim", name: "Vim bar", category: "Groceries",
        unit: "pcs", quantities: [8, 8], amounts: [70, 70] }),
    ];

    const ranked = listMeasurableCategories([potato, onion, ...groceries]);

    expect(ranked.map((c) => c.category)).toEqual([
      "Vegetables & Fruits",
      "Groceries",
    ]);
    expect(ranked[0].coherence).toBe(1);
    expect(ranked[1].coherence).toBe(0.25);
  });

  it("falls back to spend when two categories are equally coherent", () => {
    const grocery = makeItem({
      key: "kaaju",
      name: "Kaaju",
      category: "Groceries",
      quantities: [1, 1],
      amounts: [1000, 1000],
      rates: [1000, 1000],
    });

    expect(
      listMeasurableCategories([potato, grocery]).map((c) => c.category)
    ).toEqual(["Groceries", "Vegetables & Fruits"]);
  });

  it("ignores items with no quantity or a unit conflict", () => {
    const unmeasured = makeItem({
      key: "chilli",
      name: "Hari Mirch",
      unit: null,
      quantities: [null, null],
    });
    const conflicted = makeItem({
      key: "mixed",
      name: "Muddle",
      mixedUnits: true,
      unit: null,
    });

    expect(listMeasurableCategories([unmeasured, conflicted])).toEqual([]);
  });
});

describe("buildConsumptionTable", () => {
  it("lays quantities out with the staples first", () => {
    const table = buildConsumptionTable(
      [onion, potato],
      "Vegetables & Fruits",
      "quantity"
    );

    expect(table?.unit).toBe("kg");
    expect(table?.rows.map((r) => r.name)).toEqual(["Aaloo", "Pyaaz"]);
    expect(table?.rows[0].values).toEqual([12, 6]);
    expect(table?.rows[0].total).toBe(18);
  });

  it("keeps the same row order when the measure changes", () => {
    const quantity = buildConsumptionTable(
      [onion, potato],
      "Vegetables & Fruits",
      "quantity"
    );
    const rate = buildConsumptionTable(
      [onion, potato],
      "Vegetables & Fruits",
      "rate"
    );

    expect(rate?.rows.map((r) => r.name)).toEqual(
      quantity?.rows.map((r) => r.name)
    );
  });

  it("shows the per-unit rate when asked for it", () => {
    const table = buildConsumptionTable([onion], "Vegetables & Fruits", "rate");

    expect(table?.rows[0].values).toEqual([37.14, 40]);
  });

  it("blends a total rate rather than averaging the monthly ones", () => {
    // 380 spent over 10 kg is 38, not the 38.57 an average of 37.14 and 40
    // would give — the bigger month has to count for more.
    const table = buildConsumptionTable([onion], "Vegetables & Fruits", "rate");

    expect(table?.rows[0].total).toBe(38);
  });

  it("adds an all-together row across the category", () => {
    const table = buildConsumptionTable(
      [onion, potato],
      "Vegetables & Fruits",
      "quantity"
    );

    expect(table?.totalRow?.values).toEqual([19, 9]);
    expect(table?.totalRow?.total).toBe(28);
  });

  it("blends the all-together rate over the whole category", () => {
    const table = buildConsumptionTable(
      [onion, potato],
      "Vegetables & Fruits",
      "rate"
    );

    // Month one: 440 spent over 19 kg.
    expect(table?.totalRow?.values[0]).toBe(23.16);
  });

  it("sets aside items measured in another unit instead of mixing them in", () => {
    const table = buildConsumptionTable(
      [potato, onion, lemon],
      "Vegetables & Fruits",
      "quantity"
    );

    expect(table?.rows.map((r) => r.name)).toEqual(["Aaloo", "Pyaaz"]);
    expect(table?.otherUnits).toEqual([{ name: "Nimbu", unit: "pcs" }]);
  });

  it("reports a month with no purchase as nothing, not as zero", () => {
    const table = buildConsumptionTable(
      [measured({ quantities: [4, null], amounts: [60, 0] })],
      "Vegetables & Fruits",
      "quantity"
    );

    expect(table?.rows[0].values).toEqual([4, null]);
  });

  it("scales each row's shading against its own busiest month", () => {
    const table = buildConsumptionTable(
      [onion, potato],
      "Vegetables & Fruits",
      "quantity"
    );

    expect(table?.rows.map((r) => r.peak)).toEqual([12, 7]);
  });

  it("returns nothing for a category with nothing measurable in it", () => {
    expect(buildConsumptionTable([], "Vegetables & Fruits", "quantity")).toBeNull();
  });
});

describe("choosing the default category", () => {
  it("does not let a tidy but tiny category outrank the produce basket", () => {
    // Two pieces of waterproofing are perfectly coherent and completely
    // uninteresting; twenty vegetables in kilos are the reason for the screen.
    const household = [
      measured({ key: "fixit", name: "Dr. Fixit", category: "Household",
        unit: "pcs", quantities: [2, null], amounts: [200, 0] }),
      measured({ key: "cell", name: "Ghadi ke cell", category: "Household",
        unit: "pcs", quantities: [1, null], amounts: [40, 0] }),
    ];
    const produce = Array.from({ length: 12 }, (_, i) =>
      measured({ key: `v${i}`, name: `Veg ${i}`, quantities: [2, 1],
        amounts: [40, 20] })
    );
    // One odd item out, so the produce category is not perfectly coherent.
    const oddOneOut = measured({
      key: "nimbu", name: "Nimbu", unit: "pcs",
      quantities: [4, null], amounts: [10, 0],
    });

    const ranked = listMeasurableCategories([
      ...household,
      ...produce,
      oddOneOut,
    ]);

    expect(ranked[0].category).toBe("Vegetables & Fruits");
    expect(ranked[0].unit).toBe("kg");
  });
});

describe("rates when some rows are priced but not weighed", () => {
  // A mango bought by the basket has a price and no weight; a vegetable whose
  // slip recorded the weight but not the price has the reverse. Neither may
  // take part in a rupees-per-kilo figure.
  const mango = makeItem({
    key: "aam",
    name: "Aam",
    quantities: [2, 3],
    amounts: [260, 300],
    rates: [60, 100],
    pricedQuantities: [2, 3],
    pricedAmounts: [120, 300],
  });

  it("blends a row total over priced weight only", () => {
    const table = buildConsumptionTable(
      [mango],
      "Vegetables & Fruits",
      "rate"
    );

    // 420 over 5 kg is 84, and it sits between the monthly 60 and 100.
    // Dividing all 560 of spend by the same 5 kg would give 112, above both.
    expect(table?.rows[0].total).toBe(84);
  });

  it("blends the all-together row the same way", () => {
    const table = buildConsumptionTable(
      [mango],
      "Vegetables & Fruits",
      "rate"
    );

    expect(table?.totalRow?.values).toEqual([60, 100]);
    expect(table?.totalRow?.total).toBe(84);
  });

  it("still totals spend and quantity over every row", () => {
    const spend = buildConsumptionTable([mango], "Vegetables & Fruits", "amount");
    const weight = buildConsumptionTable([mango], "Vegetables & Fruits", "quantity");

    expect(spend?.totalRow?.total).toBe(560);
    expect(weight?.totalRow?.total).toBe(5);
  });
});
