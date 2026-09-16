import { describe, expect, it } from "vitest";
import {
  applyItemToLine,
  createEntryLine,
  describeReviewReasons,
  entryLinesDateRange,
  entryLinesTotal,
  entryLineToPayload,
  expenseToEntryLine,
  findLineProblem,
  groupLinesByDate,
  isBlankLine,
  slipDraftToEntryLines,
  spansMultipleDates,
  validateEntryLines,
  withLineDate,
} from "@/lib/entry-lines";
import { makeExpense, makeExpenseItem } from "@/test/fixtures/expenses";
import type { SlipDraft } from "@/types/slip";

function makeDraft(overrides: Partial<SlipDraft> = {}): SlipDraft {
  return {
    expense_date: "2026-07-07",
    spansMultipleDates: false,
    linesTotal: 70,
    statedTotal: 70,
    totalsAgree: true,
    unreadable: null,
    lines: [
      {
        id: "slip-line-0",
        raw_text: "आलू 3 kg 40",
        expense_date: "2026-07-07",
        item_id: "item-aaloo",
        item_name: "Aaloo",
        category: "Vegetables & Fruits",
        quantity: 3,
        unit: "kg",
        amount: 40,
        reviewReasons: [],
      },
      {
        id: "slip-line-1",
        raw_text: "चिरौंजी 30",
        expense_date: "2026-07-08",
        item_id: null,
        item_name: "Chironji",
        category: "Groceries",
        quantity: null,
        unit: null,
        amount: 0,
        reviewReasons: ["no-match", "no-amount"],
      },
    ],
    ...overrides,
  };
}

describe("createEntryLine", () => {
  it("starts a line empty and ready to pick", () => {
    const line = createEntryLine({ id: "a", date: "2026-07-07" });

    expect(line).toMatchObject({
      mode: "pick",
      item_id: null,
      item_name: "",
      amount: "",
      reviewReasons: [],
    });
  });
});

describe("applyItemToLine", () => {
  const item = makeExpenseItem({
    id: "item-aaloo",
    name: "Aaloo",
    category: "Vegetables & Fruits",
    default_unit: "kg",
  });

  it("adopts the item's name, category and usual unit", () => {
    const line = applyItemToLine(createEntryLine({ id: "a", date: "2026-07-07" }), item);

    expect(line).toMatchObject({
      mode: "pick",
      item_id: "item-aaloo",
      item_name: "Aaloo",
      category: "Vegetables & Fruits",
      unit: "kg",
    });
  });

  it("does not overwrite a unit the person already typed", () => {
    const typed = createEntryLine({ id: "a", date: "2026-07-07", unit: "packet" });

    expect(applyItemToLine(typed, item).unit).toBe("packet");
  });

  it("clears the scan's doubts about which item this was", () => {
    const scanned = createEntryLine({ id: "a", date: "2026-07-07",
      reviewReasons: ["fuzzy-match", "unit-differs"],
    });

    const picked = applyItemToLine(scanned, item);

    expect(picked.reviewReasons).toEqual(["unit-differs"]);
  });
});

describe("slipDraftToEntryLines", () => {
  it("carries a matched line across as a catalogue pick", () => {
    const [first] = slipDraftToEntryLines(makeDraft());

    expect(first).toMatchObject({
      mode: "pick",
      item_id: "item-aaloo",
      item_name: "Aaloo",
      quantity: "3",
      unit: "kg",
      amount: "40",
      notes: "आलू 3 kg 40",
    });
  });

  it("brings an unmatched line across as free text, still flagged", () => {
    const [, second] = slipDraftToEntryLines(makeDraft());

    expect(second).toMatchObject({
      mode: "custom",
      item_id: null,
      item_name: "Chironji",
      category: "Groceries",
      reviewReasons: ["no-match", "no-amount"],
    });
  });

  it("leaves an illegible amount blank rather than filling in a zero", () => {
    const [, second] = slipDraftToEntryLines(makeDraft());

    expect(second.amount).toBe("");
  });

  it("keeps the slip's own wording as the note, so it survives the save", () => {
    const [first, second] = slipDraftToEntryLines(makeDraft());

    expect(first.notes).toBe("आलू 3 kg 40");
    expect(second.notes).toBe("चिरौंजी 30");
  });
});

describe("expenseToEntryLine", () => {
  const items = [
    makeExpenseItem({ id: "item-1", name: "Milk", category: "Groceries", default_unit: "L" }),
  ];

  it("reopens a catalogue expense as a pick", () => {
    const line = expenseToEntryLine(makeExpense({ item_id: "item-1" }), items);

    expect(line.mode).toBe("pick");
    expect(line.item_id).toBe("item-1");
  });

  it("reopens a free-text expense as custom", () => {
    const line = expenseToEntryLine(
      makeExpense({ item_id: null, item_name: "Chironji", category: "Groceries" }),
      items
    );

    expect(line.mode).toBe("custom");
    expect(line.item_name).toBe("Chironji");
  });

  it("reopens a lump-sum expense as lump, whatever its name says", () => {
    const line = expenseToEntryLine(
      makeExpense({ item_id: null, is_itemized: false, item_name: "Groceries (mixed)" }),
      items
    );

    expect(line.mode).toBe("lump");
  });

  it("falls back to custom when the linked item has since been deleted", () => {
    const line = expenseToEntryLine(makeExpense({ item_id: "gone" }), items);

    expect(line.mode).toBe("custom");
    expect(line.item_id).toBeNull();
  });

  it("renders an absent quantity as an empty field, not the string null", () => {
    const line = expenseToEntryLine(makeExpense({ quantity: null, unit: null }), items);

    expect(line.quantity).toBe("");
    expect(line.unit).toBe("");
  });
});

describe("entryLineToPayload", () => {
  it("sends a pick as an item id with no category of its own", () => {
    const payload = entryLineToPayload(
      createEntryLine({ id: "a", date: "2026-07-07",
        mode: "pick",
        item_id: "item-1",
        item_name: "Milk",
        category: "Groceries",
        quantity: "2",
        unit: "L",
        amount: "120",
      })
    );

    expect(payload).toEqual({
      expense_date: "2026-07-07",
      mode: "pick",
      item_id: "item-1",
      custom_name: null,
      category: null,
      quantity: 2,
      unit: "L",
      amount: 120,
      notes: null,
    });
  });

  it("sends free text as a name plus its category", () => {
    const payload = entryLineToPayload(
      createEntryLine({ id: "a", date: "2026-07-07",
        mode: "custom",
        item_name: "  Chironji  ",
        category: "Groceries",
        amount: "120",
      })
    );

    expect(payload).toMatchObject({
      item_id: null,
      custom_name: "Chironji",
      category: "Groceries",
    });
  });

  it("sends a lump line as a bare category", () => {
    const payload = entryLineToPayload(
      createEntryLine({ id: "a", date: "2026-07-07", mode: "lump", category: "Groceries", amount: "500" })
    );

    expect(payload).toMatchObject({ mode: "lump", item_id: null, category: "Groceries" });
  });

  it("turns empty measurement fields into nulls rather than zeroes", () => {
    const payload = entryLineToPayload(
      createEntryLine({ id: "a", date: "2026-07-07", mode: "pick", item_id: "i", amount: "10", quantity: "  ", unit: " " })
    );

    expect(payload.quantity).toBeNull();
    expect(payload.unit).toBeNull();
  });
});

describe("entryLinesTotal", () => {
  it("adds the lines up", () => {
    const total = entryLinesTotal([
      createEntryLine({ id: "a", date: "2026-07-07", amount: "40" }),
      createEntryLine({ id: "b", date: "2026-07-07", amount: "30.5" }),
    ]);

    expect(total).toBe(70.5);
  });

  it("ignores lines with nothing typed in yet", () => {
    const total = entryLinesTotal([
      createEntryLine({ id: "a", date: "2026-07-07", amount: "40" }),
      createEntryLine({ id: "b", date: "2026-07-07", amount: "" }),
      createEntryLine({ id: "c", date: "2026-07-07", amount: "abc" }),
    ]);

    expect(total).toBe(40);
  });

  it("does not accumulate float dust across many lines", () => {
    const total = entryLinesTotal(
      Array.from({ length: 3 }, (_, i) => createEntryLine({ id: `${i}`, date: "2026-07-07", amount: "0.1" }))
    );

    expect(total).toBe(0.3);
  });

  it("is zero for an empty basket", () => {
    expect(entryLinesTotal([])).toBe(0);
  });
});

describe("isBlankLine", () => {
  it("recognises an untouched row", () => {
    expect(isBlankLine(createEntryLine({ id: "a", date: "2026-07-07" }))).toBe(true);
  });

  it("does not call a row with an amount blank", () => {
    expect(isBlankLine(createEntryLine({ id: "a", date: "2026-07-07", amount: "40" }))).toBe(false);
  });
});

describe("findLineProblem", () => {
  const picked = { id: "a", date: "2026-07-07", mode: "pick" as const, item_id: "i", amount: "40" };

  it("passes a complete line", () => {
    expect(findLineProblem(createEntryLine(picked))).toBeNull();
  });

  it("catches a missing or nonsensical amount", () => {
    expect(findLineProblem(createEntryLine({ ...picked, amount: "" }))).toBe("Needs an amount");
    expect(findLineProblem(createEntryLine({ ...picked, amount: "0" }))).toContain("more than zero");
    expect(findLineProblem(createEntryLine({ ...picked, amount: "-5" }))).toContain("more than zero");
    expect(findLineProblem(createEntryLine({ ...picked, amount: "abc" }))).toContain("more than zero");
  });

  it("catches a pick that never picked anything", () => {
    expect(
      findLineProblem(createEntryLine({ id: "a", date: "2026-07-07", mode: "pick", amount: "40" }))
    ).toBe("Pick an item");
  });

  it("catches free text with no name and no category", () => {
    expect(
      findLineProblem(createEntryLine({ id: "a", date: "2026-07-07", mode: "custom", category: "Groceries", amount: "40" }))
    ).toBe("Needs a name");

    expect(
      findLineProblem(createEntryLine({ id: "a", date: "2026-07-07", mode: "custom", item_name: "X", amount: "40" }))
    ).toBe("Needs a category");
  });

  it("catches a quantity that is not a number", () => {
    expect(
      findLineProblem(createEntryLine({ ...picked, quantity: "two" }))
    ).toBe("Quantity is not a number");
  });
});

describe("validateEntryLines", () => {
  it("drops an untouched trailing row instead of complaining about it", () => {
    const result = validateEntryLines([
      createEntryLine({ id: "a", date: "2026-07-07", mode: "pick", item_id: "i", amount: "40" }),
      createEntryLine({ id: "b", date: "2026-07-07" }),
    ]);

    expect(result.lines).toHaveLength(1);
    expect(result.problems).toEqual([]);
  });

  it("names every line that is genuinely wrong", () => {
    const result = validateEntryLines([
      createEntryLine({ id: "a", date: "2026-07-07", mode: "pick", item_id: "i", amount: "40" }),
      createEntryLine({ id: "b", date: "2026-07-07", mode: "pick", amount: "20" }),
      createEntryLine({ id: "c", date: "2026-07-07", mode: "custom", item_name: "X", category: "G", amount: "" }),
    ]);

    expect(result.problems.map((p) => p.lineId)).toEqual(["b", "c"]);
  });

  it("reports an entirely empty basket as having nothing to save", () => {
    const result = validateEntryLines([createEntryLine({ id: "a", date: "2026-07-07" })]);

    expect(result.lines).toEqual([]);
    expect(result.problems).toEqual([]);
  });
});

describe("groupLinesByDate", () => {
  function dated(id: string, date: string) {
    return createEntryLine({ id, date, mode: "pick", item_id: "i", amount: "10" });
  }

  it("heads each run of lines that share a day", () => {
    const groups = groupLinesByDate([
      dated("a", "2026-08-31"),
      dated("b", "2026-09-01"),
      dated("c", "2026-09-01"),
    ]);

    expect(groups.map((g) => [g.date, g.lines.length])).toEqual([
      ["2026-08-31", 1],
      ["2026-09-01", 2],
    ]);
  });

  it("preserves the order the page was written in rather than sorting", () => {
    const groups = groupLinesByDate([
      dated("a", "2026-09-03"),
      dated("b", "2026-08-31"),
    ]);

    expect(groups.map((g) => g.date)).toEqual(["2026-09-03", "2026-08-31"]);
  });

  it("puts a line moved to a day that already has a heading under that heading", () => {
    // Moving one misdated line should not leave the same day headed twice.
    const groups = groupLinesByDate([
      dated("a", "2026-09-07"),
      dated("b", "2026-09-08"),
      dated("c", "2026-09-07"),
    ]);

    expect(groups.map((g) => [g.date, g.lines.map((l) => l.id)])).toEqual([
      ["2026-09-07", ["a", "c"]],
      ["2026-09-08", ["b"]],
    ]);
  });

  it("returns one group for an ordinary single-day basket", () => {
    expect(groupLinesByDate([dated("a", "2026-09-01"), dated("b", "2026-09-01")])).toHaveLength(1);
  });

  it("handles an empty basket", () => {
    expect(groupLinesByDate([])).toEqual([]);
  });
});

describe("spansMultipleDates", () => {
  function dated(id: string, date: string) {
    return createEntryLine({ id, date, mode: "pick", item_id: "i", amount: "10" });
  }

  it("is false for a single day and true for a running page", () => {
    expect(spansMultipleDates([dated("a", "2026-09-01"), dated("b", "2026-09-01")])).toBe(false);
    expect(spansMultipleDates([dated("a", "2026-08-31"), dated("b", "2026-09-01")])).toBe(true);
  });
});

describe("entryLinesDateRange", () => {
  function dated(id: string, date: string) {
    return createEntryLine({ id, date, mode: "pick", item_id: "i", amount: "10" });
  }

  it("spans the earliest to the latest day, whatever order the lines are in", () => {
    expect(
      entryLinesDateRange([
        dated("a", "2026-09-03"),
        dated("b", "2026-08-31"),
        dated("c", "2026-09-01"),
      ])
    ).toEqual({ from: "2026-08-31", to: "2026-09-03" });
  });

  it("is a single day for a single-day basket, and nothing for an empty one", () => {
    expect(entryLinesDateRange([dated("a", "2026-09-01")])).toEqual({
      from: "2026-09-01",
      to: "2026-09-01",
    });
    expect(entryLinesDateRange([])).toBeNull();
  });
});

describe("withLineDate", () => {
  it("moves a line to another day", () => {
    const line = createEntryLine({ id: "a", date: "2026-09-07" });

    expect(withLineDate(line, "2026-09-08").date).toBe("2026-09-08");
  });

  it("settles a scan's doubt about the date, and only that", () => {
    const line = createEntryLine({
      id: "a",
      date: "2026-01-09",
      reviewReasons: ["fuzzy-match", "date-check"],
    });

    expect(withLineDate(line, "2026-09-01").reviewReasons).toEqual(["fuzzy-match"]);
  });

  it("does not change the line it was given", () => {
    const line = createEntryLine({ id: "a", date: "2026-09-07", reviewReasons: ["date-check"] });

    withLineDate(line, "2026-09-08");

    expect(line).toMatchObject({ date: "2026-09-07", reviewReasons: ["date-check"] });
  });
});

describe("describeReviewReasons for dates", () => {
  it("tells the person to check a doubtful date against the slip", () => {
    const line = createEntryLine({ id: "a", date: "2026-01-09", reviewReasons: ["date-check"] });

    expect(describeReviewReasons(line)[0]).toContain("check it against the slip");
  });
});

describe("findLineProblem date checks", () => {
  it("rejects a line whose date is missing or malformed", () => {
    const base = { id: "a", mode: "pick" as const, item_id: "i", amount: "40" };

    expect(findLineProblem(createEntryLine({ ...base, date: "" }))).toBe("Needs a date");
    expect(findLineProblem(createEntryLine({ ...base, date: "2.9.26" }))).toBe("Needs a date");
    expect(findLineProblem(createEntryLine({ ...base, date: "2026-09-02" }))).toBeNull();
  });
});
