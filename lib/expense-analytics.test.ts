import { describe, expect, it } from "vitest";
import { makeExpense } from "@/test/fixtures/expenses";
import {
  buildExpenseAnalytics,
  buildPurchasePatterns,
  buildPurchaseRhythms,
  daysInMonth,
  deltaSeries,
  dominantUnit,
  longestGap,
  MAX_RHYTHM_HISTORY,
} from "./expense-analytics";

function build(
  expenses: ReturnType<typeof makeExpense>[],
  {
    today = "2026-09-09",
    windowMonths = 6,
    unlocked = true,
  }: { today?: string; windowMonths?: number; unlocked?: boolean } = {}
) {
  return buildExpenseAnalytics(expenses, { today, windowMonths, unlocked });
}

function veg(date: string, name: string, quantity: number, amount: number) {
  return makeExpense({
    id: `${name}-${date}`,
    expense_date: date,
    item_id: `item-${name}`,
    item_name: name,
    category: "Vegetables & Fruits",
    quantity,
    unit: "kg",
    amount,
  });
}

describe("daysInMonth", () => {
  it("handles month lengths including leap February", () => {
    expect(daysInMonth("2026-09")).toBe(30);
    expect(daysInMonth("2026-08")).toBe(31);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("longestGap", () => {
  it("counts the longest unlogged run, including a trailing one", () => {
    expect(longestGap(new Set([1, 2, 8, 9]), 15)).toBe(6);
  });

  it("is zero when every day has an entry", () => {
    expect(longestGap(new Set([1, 2, 3]), 3)).toBe(0);
  });

  it("only looks at days that have happened", () => {
    // Nothing after the 3rd is a gap yet — the month is still running.
    expect(longestGap(new Set([1, 2, 3]), 3)).toBe(0);
    expect(longestGap(new Set([1, 2, 3]), 10)).toBe(7);
  });
});

describe("dominantUnit", () => {
  it("returns the unit when there is exactly one", () => {
    expect(
      dominantUnit({ name: "Aaloo", category: "V", units: new Map([["kg", 4]]) })
    ).toBe("kg");
  });

  it("refuses to pick a unit when the item has been logged in two", () => {
    expect(
      dominantUnit({
        name: "Aaloo",
        category: "V",
        units: new Map([
          ["kg", 4],
          ["g", 1],
        ]),
      })
    ).toBeNull();
  });
});

describe("buildExpenseAnalytics", () => {
  it("returns an empty shape when there is nothing to analyse", () => {
    const result = build([]);

    expect(result.months).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.items).toEqual([]);
    expect(result.rhythms).toEqual([]);
    expect(result.learningItems).toEqual([]);
  });

  it("fills in months that have no expenses so the trend does not lie", () => {
    const result = build([
      veg("2026-07-05", "Pyaaz", 2, 70),
      veg("2026-09-01", "Pyaaz", 2, 100),
    ]);

    expect(result.months.map((m) => m.month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(result.months[1].total).toBe(0);
    expect(result.months[1].entryCount).toBe(0);
  });

  it("never starts the window before the first month with data", () => {
    const result = build([veg("2026-08-05", "Pyaaz", 2, 70)], {
      windowMonths: 12,
    });

    expect(result.months[0].month).toBe("2026-08");
  });

  it("trims to the requested window", () => {
    const result = build(
      [
        veg("2026-07-05", "Pyaaz", 2, 70),
        veg("2026-08-05", "Pyaaz", 2, 80),
        veg("2026-09-05", "Pyaaz", 2, 90),
      ],
      { windowMonths: 2 }
    );

    expect(result.months.map((m) => m.month)).toEqual(["2026-08", "2026-09"]);
  });

  it("compares against the real previous month even when it is outside the window", () => {
    const result = build(
      [
        veg("2026-07-05", "Pyaaz", 2, 100),
        veg("2026-08-05", "Pyaaz", 2, 150),
      ],
      { windowMonths: 1, today: "2026-08-31" }
    );

    expect(result.months).toHaveLength(1);
    expect(result.months[0].month).toBe("2026-08");
    // 150 vs the July 100 that the window does not show.
    expect(result.months[0].deltaAmount).toBe(50);
    expect(result.months[0].deltaPct).toBe(50);
  });

  it("leaves the delta null for the very first month", () => {
    const result = build([veg("2026-09-01", "Pyaaz", 2, 90)]);

    expect(result.months[0].deltaAmount).toBeNull();
    expect(result.months[0].deltaPct).toBeNull();
  });

  it("projects a run rate only for the month in progress", () => {
    const result = build([veg("2026-09-01", "Pyaaz", 2, 900)], {
      today: "2026-09-09",
    });

    const september = result.months.at(-1);
    expect(september?.isCurrentMonth).toBe(true);
    expect(september?.daysElapsed).toBe(9);
    expect(september?.avgPerDay).toBe(100);
    // 900 over 9 days, across a 30-day month.
    expect(september?.projectedTotal).toBe(3000);
  });

  it("does not project in the first days of a month", () => {
    const result = build([veg("2026-09-01", "Pyaaz", 2, 900)], {
      today: "2026-09-02",
    });

    expect(result.months.at(-1)?.projectedTotal).toBeNull();
  });

  it("does not project for a finished month", () => {
    const result = build([veg("2026-08-01", "Pyaaz", 2, 900)], {
      today: "2026-09-09",
    });

    const august = result.months.find((m) => m.month === "2026-08");
    expect(august?.projectedTotal).toBeNull();
    // A past month averages over all of its days, not the elapsed ones.
    expect(august?.daysElapsed).toBe(31);
  });

  it("adds up quantities per item per month", () => {
    const result = build([
      veg("2026-08-05", "Pyaaz", 2, 70),
      veg("2026-08-20", "Pyaaz", 1, 40),
      veg("2026-09-01", "Pyaaz", 2, 100),
    ]);

    const onion = result.items.find((i) => i.name === "Pyaaz");
    expect(onion?.unit).toBe("kg");
    expect(onion?.quantities).toEqual([3, 2]);
    expect(onion?.amounts).toEqual([110, 100]);
  });

  it("rolls consumption up to the category, per unit", () => {
    const result = build([
      veg("2026-09-01", "Pyaaz", 2, 100),
      veg("2026-09-01", "Aaloo", 3, 60),
    ]);

    const kilos = result.consumption.find(
      (c) => c.category === "Vegetables & Fruits" && c.unit === "kg"
    );
    expect(kilos?.quantities).toEqual([5]);
  });

  it("reports a per-unit rate", () => {
    const result = build([
      veg("2026-08-05", "Pyaaz", 2, 70),
      veg("2026-09-01", "Pyaaz", 2, 100),
    ]);

    expect(result.items[0].rates).toEqual([35, 50]);
  });

  it("keeps an unpriced row out of the rate but inside the quantity", () => {
    // A slip that recorded the weight but not the price would otherwise drag
    // the rupees-per-kilo figure down.
    const result = build([
      veg("2026-09-01", "Pyaaz", 1, 50),
      veg("2026-09-02", "Pyaaz", 1, 0),
    ]);

    const onion = result.items[0];
    expect(onion.quantities).toEqual([2]);
    expect(onion.rates).toEqual([50]);
  });

  it("reports no quantity for an item logged in two different units", () => {
    const result = build([
      veg("2026-09-01", "Pyaaz", 2, 100),
      makeExpense({
        id: "mixed",
        expense_date: "2026-09-02",
        item_id: "item-Pyaaz",
        item_name: "Pyaaz",
        category: "Vegetables & Fruits",
        quantity: 500,
        unit: "g",
        amount: 25,
      }),
    ]);

    const onion = result.items[0];
    expect(onion.mixedUnits).toBe(true);
    expect(onion.unit).toBeNull();
    expect(onion.quantities).toEqual([null]);
    // Spend is still trustworthy, so it is still reported.
    expect(onion.amounts).toEqual([125]);
    // The overall typical quantity is withheld, but each dated log entry can
    // still show the unit that was actually recorded that day.
    expect(result.rhythms[0]).toMatchObject({
      unit: null,
      typicalQuantity: null,
      history: [
        expect.objectContaining({ date: "2026-09-02", quantity: 500, unit: "g" }),
        expect.objectContaining({ date: "2026-09-01", quantity: 2, unit: "kg" }),
      ],
    });
  });

  it("groups an item by id so a rename keeps its history together", () => {
    // Same catalogue row, spelled differently before and after a rename.
    const result = build([
      { ...veg("2026-08-05", "Pyaz", 2, 70), item_id: "item-onion" },
      { ...veg("2026-09-01", "Pyaaz", 2, 100), item_id: "item-onion" },
    ]);

    expect(result.items).toHaveLength(1);
    // The most recent spelling is the one shown.
    expect(result.items[0].name).toBe("Pyaaz");
    expect(result.items[0].quantities).toEqual([2, 2]);
  });

  it("keeps lump-sum rows out of the item list but inside the totals", () => {
    const result = build([
      veg("2026-09-01", "Pyaaz", 2, 100),
      makeExpense({
        id: "lump",
        expense_date: "2026-09-02",
        item_id: null,
        item_name: "Vegetables & Fruits (mixed)",
        category: "Vegetables & Fruits",
        quantity: null,
        unit: null,
        amount: 150,
        is_itemized: false,
      }),
    ]);

    expect(result.months[0].total).toBe(250);
    expect(result.categories[0].amounts).toEqual([250]);
    expect(result.items.map((i) => i.name)).toEqual(["Pyaaz"]);
  });

  it("counts days covered and the longest gap in logging", () => {
    const result = build(
      [veg("2026-08-01", "Pyaaz", 1, 50), veg("2026-08-09", "Pyaaz", 1, 50)],
      { today: "2026-09-09" }
    );

    const august = result.months.find((m) => m.month === "2026-08");
    expect(august?.daysWithEntries).toBe(2);
    expect(august?.daysInMonth).toBe(31);
    // The 10th through the 31st, once the 2nd-to-8th run is beaten.
    expect(august?.longestGapDays).toBe(22);
  });

  it("hides line-item detail when the caller is locked out", () => {
    const result = build([veg("2026-09-01", "Pyaaz", 2, 100)], {
      unlocked: false,
    });

    expect(result.unlocked).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.consumption).toEqual([]);
    expect(result.rhythms).toEqual([]);
    expect(result.learningItems).toEqual([]);
    expect(result.months[0].missingRecurring).toEqual([]);
    expect(result.months[0].priceMoves).toEqual([]);
    // Headline totals stay open, matching GET /api/expenses.
    expect(result.months[0].total).toBe(100);
    expect(result.categories[0].amounts).toEqual([100]);
  });

  it("ignores rows with an unusable date", () => {
    const result = build([
      veg("2026-09-01", "Pyaaz", 2, 100),
      makeExpense({ id: "bad", expense_date: "not-a-date", amount: 999 }),
    ]);

    expect(result.months[0].total).toBe(100);
  });
});

describe("purchase rhythms", () => {
  it("keeps a recent first cylinder purchase visible without inventing a duration", () => {
    const patterns = buildPurchasePatterns(
      [
        makeExpense({
          id: "gas-1",
          expense_date: "2026-09-02",
          item_id: "item-gas",
          item_name: "LPG Cylinder",
          category: "Utilities",
          quantity: 1,
          unit: null,
          amount: 1025,
        }),
      ],
      "2026-09-17"
    );

    expect(patterns.rhythms).toEqual([]);
    expect(patterns.learningItems).toEqual([
      expect.objectContaining({
        name: "LPG Cylinder",
        lastBoughtOn: "2026-09-02",
        daysSinceLast: 15,
        purchaseCount: 1,
        history: [
          expect.objectContaining({
            amount: 1025,
            quantity: 1,
            unit: null,
          }),
        ],
      }),
    ]);
  });

  it("does not present an unmeasured one-off expense as a replenishment item", () => {
    const patterns = buildPurchasePatterns(
      [
        makeExpense({
          expense_date: "2026-09-02",
          item_name: "Electricity bill",
          category: "Utilities",
          quantity: null,
          unit: null,
          amount: 2500,
        }),
      ],
      "2026-09-17"
    );

    expect(patterns.learningItems).toEqual([]);
  });

  it("turns repeat purchases into a useful buy-again estimate", () => {
    const rhythms = buildPurchaseRhythms(
      [
        veg("2026-09-01", "Aaloo", 2, 40),
        veg("2026-09-07", "Aaloo", 3, 60),
        veg("2026-09-12", "Aaloo", 2, 45),
      ],
      "2026-09-17"
    );

    expect(rhythms).toEqual([
      expect.objectContaining({
        name: "Aaloo",
        typicalDays: 6,
        lastGapDays: 5,
        recentMinDays: 5,
        recentMaxDays: 6,
        lastBoughtOn: "2026-09-12",
        daysSinceLast: 5,
        dueInDays: 1,
        timing: "soon",
        cycleProgressPct: 83,
        purchaseCount: 3,
        intervalCount: 2,
        typicalQuantity: 2,
        unit: "kg",
        history: [
          {
            date: "2026-09-12",
            amount: 45,
            quantity: 2,
            unit: "kg",
            daysSincePrevious: 5,
            otherItems: [],
          },
          {
            date: "2026-09-07",
            amount: 60,
            quantity: 3,
            unit: "kg",
            daysSincePrevious: 6,
            otherItems: [],
          },
          {
            date: "2026-09-01",
            amount: 40,
            quantity: 2,
            unit: "kg",
            daysSincePrevious: null,
            otherItems: [],
          },
        ],
        historyTruncated: false,
      }),
    ]);
  });

  it("describes a refill by the days between cylinder purchases", () => {
    const cylinder = (date: string) =>
      makeExpense({
        id: `gas-${date}`,
        expense_date: date,
        item_id: "item-gas",
        item_name: "LPG Cylinder",
        category: "Utilities",
        quantity: 1,
        unit: "cylinder",
        amount: 1025,
      });

    const rhythms = buildPurchaseRhythms(
      [cylinder("2026-07-01"), cylinder("2026-08-03"), cylinder("2026-09-05")],
      "2026-09-17"
    );

    expect(rhythms[0]).toMatchObject({
      name: "LPG Cylinder",
      typicalDays: 33,
      lastGapDays: 33,
      dueInDays: 21,
      timing: "later",
    });
  });

  it("counts several lines on one day as one purchase", () => {
    const rhythms = buildPurchaseRhythms(
      [
        veg("2026-09-01", "Aaloo", 1, 20),
        veg("2026-09-01", "Aaloo", 2, 40),
        veg("2026-09-01", "Pyaaz", 1, 30),
        veg("2026-09-08", "Aaloo", 3, 60),
        veg("2026-09-08", "Tamatar", 2, 80),
      ],
      "2026-09-10"
    );

    expect(rhythms[0]).toMatchObject({
      purchaseCount: 2,
      intervalCount: 1,
      typicalDays: 7,
      typicalQuantity: 3,
      history: [
        {
          date: "2026-09-08",
          amount: 60,
          quantity: 3,
          unit: "kg",
          daysSincePrevious: 7,
          otherItems: ["Tamatar"],
        },
        {
          date: "2026-09-01",
          amount: 60,
          quantity: 3,
          unit: "kg",
          daysSincePrevious: null,
          otherItems: ["Pyaaz"],
        },
      ],
    });
  });

  it("keeps the detail log useful without returning an unbounded history", () => {
    const rows = Array.from({ length: MAX_RHYTHM_HISTORY + 2 }, (_, index) =>
      veg(`2026-09-${String(index + 1).padStart(2, "0")}`, "Aaloo", 2, 40)
    );

    const rhythm = buildPurchaseRhythms(rows, "2026-09-16")[0];

    expect(rhythm.history).toHaveLength(MAX_RHYTHM_HISTORY);
    expect(rhythm.history[0].date).toBe("2026-09-14");
    expect(rhythm.history.at(-1)?.date).toBe("2026-09-03");
    expect(rhythm.historyTruncated).toBe(true);
  });

  it("uses recent gaps and drops routines that appear abandoned", () => {
    const dates = [
      "2026-01-01",
      "2026-02-10",
      "2026-03-22",
      "2026-05-01",
      "2026-05-08",
      "2026-05-15",
      "2026-05-22",
      "2026-05-29",
    ];
    const rows = dates.map((date) => veg(date, "Aaloo", 2, 40));

    // The last six gaps are four weekly gaps plus two older 40-day gaps, so
    // the median reflects the newer weekly habit.
    expect(buildPurchaseRhythms(rows, "2026-06-01")[0].typicalDays).toBe(7);
    // Months later it no longer crowds the screen as eternally overdue.
    expect(buildPurchaseRhythms(rows, "2026-09-17")).toEqual([]);
  });

  it("ignores future purchases and items only bought once", () => {
    expect(
      buildPurchaseRhythms(
        [
          veg("2026-09-01", "Aaloo", 2, 40),
          veg("2026-09-20", "Aaloo", 2, 40),
        ],
        "2026-09-17"
      )
    ).toEqual([]);
  });
});

describe("recurring gaps", () => {
  function salary(month: string, amount = 8500) {
    return makeExpense({
      id: `salary-${month}`,
      expense_date: `${month}-01`,
      item_id: "item-salary",
      item_name: "Rahib Yadav",
      category: "Household Help",
      quantity: null,
      unit: null,
      amount,
    });
  }

  it("flags a monthly commitment that stopped being logged", () => {
    const result = build([salary("2026-07"), veg("2026-08-05", "Pyaaz", 2, 70)]);

    const august = result.months.find((m) => m.month === "2026-08");
    expect(august?.missingRecurring).toEqual([
      {
        name: "Rahib Yadav",
        category: "Household Help",
        monthsSeen: 1,
        typicalAmount: 8500,
      },
    ]);
  });

  it("does not flag something that was logged this month", () => {
    const result = build([salary("2026-07"), salary("2026-08")]);

    const august = result.months.find((m) => m.month === "2026-08");
    expect(august?.missingRecurring).toEqual([]);
  });

  it("never flags anything in the first month of the series", () => {
    const result = build([salary("2026-07")]);

    expect(result.months[0].missingRecurring).toEqual([]);
  });

  it("ignores items bought too often to be a monthly commitment", () => {
    // Vegetables bought four times in July are daily shopping, so their
    // absence on any given day says nothing.
    const july = [5, 10, 15, 20].map((d) =>
      veg(`2026-07-${String(d).padStart(2, "0")}`, "Pyaaz", 2, 500)
    );
    const result = build([...july, salary("2026-08")]);

    const august = result.months.find((m) => m.month === "2026-08");
    expect(august?.missingRecurring.map((g) => g.name)).not.toContain("Pyaaz");
  });

  it("ignores amounts too small to chase", () => {
    const result = build([
      veg("2026-07-05", "Nimbu", 4, 10),
      salary("2026-08"),
    ]);

    const august = result.months.find((m) => m.month === "2026-08");
    expect(august?.missingRecurring).toEqual([]);
  });

  it("ranks the biggest commitments first and caps the list", () => {
    const july = Array.from({ length: 9 }, (_, i) =>
      makeExpense({
        id: `bill-${i}`,
        expense_date: "2026-07-01",
        item_id: `item-bill-${i}`,
        item_name: `Bill ${i}`,
        category: "Utilities",
        quantity: null,
        unit: null,
        amount: 300 + i * 100,
      })
    );
    const result = build([...july, veg("2026-08-05", "Pyaaz", 2, 70)]);

    const august = result.months.find((m) => m.month === "2026-08");
    expect(august?.missingRecurring).toHaveLength(6);
    expect(august?.missingRecurring[0].name).toBe("Bill 8");
    expect(august?.missingRecurring[0].typicalAmount).toBe(1100);
  });
});

describe("price moves", () => {
  it("reports what got more expensive per unit", () => {
    const result = build([
      veg("2026-08-05", "Pyaaz", 4, 140),
      veg("2026-09-01", "Pyaaz", 4, 200),
    ]);

    const september = result.months.find((m) => m.month === "2026-09");
    expect(september?.priceMoves).toEqual([
      { name: "Pyaaz", unit: "kg", rate: 50, prevRate: 35, deltaPct: 42.9 },
    ]);
  });

  it("stays quiet when the rate did not move", () => {
    const result = build([
      veg("2026-08-05", "Pyaaz", 4, 200),
      veg("2026-09-01", "Pyaaz", 4, 200),
    ]);

    expect(result.months.at(-1)?.priceMoves).toEqual([]);
  });

  it("ignores a move on too little spend to be meaningful", () => {
    const result = build([
      veg("2026-08-05", "Nimbu", 1, 10),
      veg("2026-09-01", "Nimbu", 1, 40),
    ]);

    expect(result.months.at(-1)?.priceMoves).toEqual([]);
  });

  it("needs a rate in both months", () => {
    const result = build([veg("2026-09-01", "Pyaaz", 4, 200)]);

    expect(result.months.at(-1)?.priceMoves).toEqual([]);
  });

  it("puts the biggest move first, in either direction", () => {
    const result = build([
      veg("2026-08-05", "Pyaaz", 4, 200),
      veg("2026-09-01", "Pyaaz", 4, 180),
      veg("2026-08-05", "Aaloo", 4, 200),
      veg("2026-09-01", "Aaloo", 4, 400),
    ]);

    const moves = result.months.at(-1)?.priceMoves ?? [];
    expect(moves[0]).toMatchObject({ name: "Aaloo", deltaPct: 100 });
    expect(moves[1]).toMatchObject({ name: "Pyaaz", deltaPct: -10 });
  });
});

describe("deltaSeries", () => {
  it("gives a percentage change per month", () => {
    expect(deltaSeries([100, 150, 75])).toEqual([null, 50, -50]);
  });

  it("declines to divide by a zero month", () => {
    expect(deltaSeries([0, 200])).toEqual([null, null]);
  });
});

describe("category and consumption deltas", () => {
  it("carries a per-month change alongside each series", () => {
    const result = build([
      veg("2026-08-05", "Pyaaz", 2, 100),
      veg("2026-09-01", "Pyaaz", 3, 150),
    ]);

    expect(result.categories[0].deltaPcts).toEqual([null, 50]);
    expect(result.consumption[0].deltaPcts).toEqual([null, 50]);
  });

  it("keeps a category name containing spaces intact when grouping consumption", () => {
    const result = build([veg("2026-09-01", "Pyaaz", 2, 100)]);

    expect(result.consumption[0]).toMatchObject({
      category: "Vegetables & Fruits",
      unit: "kg",
    });
  });
});

describe("top items", () => {
  it("ranks a month's biggest items", () => {
    const result = build([
      veg("2026-09-01", "Pyaaz", 2, 100),
      veg("2026-09-02", "Aaloo", 3, 300),
    ]);

    expect(result.months[0].topItems).toEqual([
      { name: "Aaloo", category: "Vegetables & Fruits", amount: 300 },
      { name: "Pyaaz", category: "Vegetables & Fruits", amount: 100 },
    ]);
  });

  it("caps the list", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      veg("2026-09-01", `Item ${i}`, 1, 10 + i)
    );

    expect(build(rows).months[0].topItems).toHaveLength(6);
  });

  it("stays empty when the caller is locked out", () => {
    const result = build([veg("2026-09-01", "Pyaaz", 2, 100)], {
      unlocked: false,
    });

    expect(result.months[0].topItems).toEqual([]);
  });
});

describe("consumption grouping", () => {
  it("ranks groups by the money behind them, not the raw quantity", () => {
    const result = build([
      // Many cheap units versus few expensive kilos.
      makeExpense({
        id: "packets",
        expense_date: "2026-09-01",
        item_id: "i-biscuit",
        item_name: "Good day biscuit",
        category: "Groceries",
        quantity: 40,
        unit: "packet",
        amount: 200,
      }),
      veg("2026-09-01", "Kaaju", 1, 1200),
    ]);

    expect(result.consumption.map((c) => c.unit)).toEqual(["kg", "packet"]);
    expect(result.consumption[0].amounts).toEqual([1200]);
  });

  it("caps the groups so a long unit tail cannot crowd the payload", () => {
    const units = ["kg", "packet", "pcs", "pack", "L", "glass", "box", "tin", "jar", "bag"];
    const rows = units.map((unit, i) =>
      makeExpense({
        id: `u-${unit}`,
        expense_date: "2026-09-01",
        item_id: `i-${unit}`,
        item_name: `Item ${unit}`,
        category: "Groceries",
        quantity: 2,
        unit,
        amount: 100 + i,
      })
    );

    expect(build(rows).consumption).toHaveLength(8);
  });
});

describe("priced subtotals", () => {
  it("separates spend that can be divided by a weight from spend that cannot", () => {
    const result = build([
      // Priced and weighed.
      veg("2026-09-01", "Aam", 2, 120),
      // Priced, but bought by the basket with no weight recorded.
      makeExpense({
        id: "basket",
        expense_date: "2026-09-02",
        item_id: "item-Aam",
        item_name: "Aam",
        category: "Vegetables & Fruits",
        quantity: null,
        unit: null,
        amount: 140,
      }),
      // Weighed, but the slip never recorded a price.
      veg("2026-09-03", "Aam", 1, 0),
    ]);

    const mango = result.items[0];
    expect(mango.amounts).toEqual([260]);
    expect(mango.quantities).toEqual([3]);
    // Only the first row may take part in a rupees-per-kilo figure.
    expect(mango.pricedAmounts).toEqual([120]);
    expect(mango.pricedQuantities).toEqual([2]);
    expect(mango.rates).toEqual([60]);
  });
});
