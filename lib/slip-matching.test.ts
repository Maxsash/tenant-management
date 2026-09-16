import { describe, expect, it } from "vitest";
import {
  buildSlipDraft,
  DATE_TUNING,
  findSuspectDates,
  foldName,
  matchCatalogueItem,
  resolveCategory,
  similarity,
} from "@/lib/slip-matching";
import { makeExpenseCategory, makeExpenseItem } from "@/test/fixtures/expenses";
import type { SlipExtraction, SlipLine } from "@/types/slip";

const categories = [
  makeExpenseCategory({ id: "cat-veg", name: "Vegetables & Fruits", icon: "🥬" }),
  makeExpenseCategory({ id: "cat-groc", name: "Groceries", icon: "🛒", sort_order: 1 }),
  makeExpenseCategory({ id: "cat-other", name: "Other", icon: "📦", sort_order: 9 }),
];

const items = [
  makeExpenseItem({
    id: "item-aaloo",
    name: "Aaloo",
    category: "Vegetables & Fruits",
    default_unit: "kg",
  }),
  makeExpenseItem({
    id: "item-pyaaz",
    name: "Pyaaz",
    category: "Vegetables & Fruits",
    default_unit: "kg",
  }),
  makeExpenseItem({
    id: "item-butter",
    name: "Amul butter",
    category: "Groceries",
    default_unit: "kg",
  }),
  makeExpenseItem({
    id: "item-nimbu",
    name: "Nimbu",
    category: "Vegetables & Fruits",
    default_unit: "pcs",
  }),
];

function makeSlipLine(overrides: Partial<SlipLine> = {}): SlipLine {
  return {
    raw_text: "आलू 3 kg 40",
    line_date: null,
    item_name: "Aaloo",
    category: null,
    quantity: 3,
    unit: "kg",
    amount: 40,
    ...overrides,
  };
}

function makeExtraction(overrides: Partial<SlipExtraction> = {}): SlipExtraction {
  return {
    slip_date: "2026-07-07",
    stated_total: null,
    lines: [makeSlipLine()],
    unreadable: null,
    ...overrides,
  };
}

describe("foldName", () => {
  it("converges the spellings of one transliterated word", () => {
    expect(foldName("Aaloo")).toBe(foldName("Aalu"));
    expect(foldName("Aaloo")).toBe(foldName("alu"));
    expect(foldName("Pyaaz")).toBe(foldName("Pyaz"));
  });

  it("strips punctuation and case", () => {
    expect(foldName("Chai-patti (Red Label)")).toBe(foldName("chai patti red label"));
  });

  it("returns empty for a name with nothing to fold", () => {
    expect(foldName("   ")).toBe("");
    expect(foldName("!!!")).toBe("");
  });
});

describe("similarity", () => {
  it("scores identical strings 1 and unrelated ones low", () => {
    expect(similarity("aloo", "aloo")).toBe(1);
    expect(similarity("aloo", "ghee")).toBeLessThan(0.3);
  });

  it("treats two empty strings as identical rather than dividing by zero", () => {
    expect(similarity("", "")).toBe(1);
  });
});

describe("matchCatalogueItem", () => {
  it("matches an alternate spelling exactly once folded", () => {
    const match = matchCatalogueItem("Aalu", items);

    expect(match?.item.id).toBe("item-aaloo");
    expect(match?.kind).toBe("exact");
  });

  it("finds a catalogue name written inside a longer slip phrase", () => {
    const match = matchCatalogueItem("Amul butter 100g", items);

    expect(match?.item.id).toBe("item-butter");
    expect(match?.kind).toBe("fuzzy");
  });

  it("returns null rather than reaching for an unrelated item", () => {
    expect(matchCatalogueItem("Chironji", items)).toBeNull();
    expect(matchCatalogueItem("", items)).toBeNull();
  });

  it("reports a near-tie as ambiguous and names the runner-up", () => {
    // The everyday case: the slip writes the plain word, the catalogue holds
    // two variants of it. Picking one silently would be a coin toss, and here
    // the wrong side of it is a different spice.
    const variants = [
      makeExpenseItem({ id: "lal", name: "Lal mirch powder" }),
      makeExpenseItem({ id: "kali", name: "Kali mirch powder" }),
    ];

    const match = matchCatalogueItem("Mirch powder", variants);

    expect(match?.kind).toBe("ambiguous");
    expect(match?.runnerUp?.id).toBe("kali");
  });

  it("flags that ambiguity on the draft line, not just in the match", () => {
    const variants = [
      makeExpenseItem({ id: "lal", name: "Lal mirch powder", category: "Groceries" }),
      makeExpenseItem({ id: "kali", name: "Kali mirch powder", category: "Groceries" }),
    ];

    const draft = buildSlipDraft(
      makeExtraction({
        lines: [makeSlipLine({ item_name: "Mirch powder", quantity: null, unit: null })],
      }),
      { items: variants, categories, today: "2026-09-09" }
    );

    expect(draft.lines[0].reviewReasons).toContain("ambiguous-match");
  });

  it("does not let a short name claim a longer one by containment", () => {
    const catalogue = [makeExpenseItem({ id: "aam", name: "Aam" })];

    // "Aam" is inside "Badaam", but too short for containment to count.
    expect(matchCatalogueItem("Badaam ki barfi", catalogue)).toBeNull();
  });
});

describe("resolveCategory", () => {
  it("honours a suggestion that names a real category", () => {
    expect(resolveCategory("groceries", categories)).toBe("Groceries");
  });

  it("refuses an invented category, falling back to Other", () => {
    expect(resolveCategory("Snacks & Treats", categories)).toBe("Other");
    expect(resolveCategory(null, categories)).toBe("Other");
  });

  it("falls back to the first category when there is no Other", () => {
    const withoutOther = categories.filter((c) => c.name !== "Other");

    expect(resolveCategory("nonsense", withoutOther)).toBe("Vegetables & Fruits");
  });

  it("still returns something when the catalogue has no categories at all", () => {
    expect(resolveCategory(null, [])).toBe("Other");
  });
});

describe("buildSlipDraft", () => {
  const options = { items, categories, today: "2026-09-09" };

  it("links a matched line to the catalogue item and its category", () => {
    const draft = buildSlipDraft(makeExtraction(), options);

    expect(draft.lines[0]).toMatchObject({
      item_id: "item-aaloo",
      item_name: "Aaloo",
      category: "Vegetables & Fruits",
      quantity: 3,
      unit: "kg",
      amount: 40,
      reviewReasons: [],
    });
  });

  it("renames an alternate spelling to the catalogue's, keeping one history", () => {
    const draft = buildSlipDraft(
      makeExtraction({ lines: [makeSlipLine({ item_name: "Alu" })] }),
      options
    );

    expect(draft.lines[0].item_name).toBe("Aaloo");
    expect(draft.lines[0].item_id).toBe("item-aaloo");
  });

  it("normalises grams onto the catalogue's kilos without flagging it", () => {
    const draft = buildSlipDraft(
      makeExtraction({
        lines: [makeSlipLine({ quantity: 500, unit: "g" })],
      }),
      options
    );

    expect(draft.lines[0].quantity).toBe(0.5);
    expect(draft.lines[0].unit).toBe("kg");
    expect(draft.lines[0].reviewReasons).toEqual([]);
  });

  it("adopts the catalogue unit when the slip wrote a bare number", () => {
    const draft = buildSlipDraft(
      makeExtraction({ lines: [makeSlipLine({ quantity: 2, unit: null })] }),
      options
    );

    expect(draft.lines[0].unit).toBe("kg");
  });

  it("flags a unit that genuinely disagrees with the catalogue's", () => {
    const draft = buildSlipDraft(
      makeExtraction({
        lines: [makeSlipLine({ item_name: "Nimbu", quantity: 1, unit: "kg" })],
      }),
      options
    );

    expect(draft.lines[0].reviewReasons).toContain("unit-differs");
  });

  it("flags an unmatched line and gives it a real category", () => {
    const draft = buildSlipDraft(
      makeExtraction({
        lines: [
          makeSlipLine({
            item_name: "Chironji",
            category: "Groceries",
            quantity: null,
            unit: null,
          }),
        ],
      }),
      options
    );

    expect(draft.lines[0]).toMatchObject({
      item_id: null,
      item_name: "Chironji",
      category: "Groceries",
      reviewReasons: ["no-match"],
    });
  });

  it("keeps an illegible line at zero and flags it rather than dropping it", () => {
    const draft = buildSlipDraft(
      makeExtraction({ lines: [makeSlipLine({ amount: 0 })] }),
      options
    );

    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0].amount).toBe(0);
    expect(draft.lines[0].reviewReasons).toContain("no-amount");
  });

  it("reconciles the slip's own total against what its lines add up to", () => {
    const agreeing = buildSlipDraft(
      makeExtraction({
        stated_total: 70,
        lines: [makeSlipLine({ amount: 40 }), makeSlipLine({ amount: 30 })],
      }),
      options
    );

    expect(agreeing.linesTotal).toBe(70);
    expect(agreeing.totalsAgree).toBe(true);

    const disagreeing = buildSlipDraft(
      makeExtraction({ stated_total: 460, lines: [makeSlipLine({ amount: 40 })] }),
      options
    );

    expect(disagreeing.totalsAgree).toBe(false);
  });

  it("reports no verdict when the slip stated no total", () => {
    expect(buildSlipDraft(makeExtraction(), options).totalsAgree).toBeNull();
  });

  it("falls back to the supplied date when the slip is undated or misread", () => {
    expect(
      buildSlipDraft(makeExtraction({ slip_date: null }), options).expense_date
    ).toBe("2026-09-09");

    expect(
      buildSlipDraft(makeExtraction({ slip_date: "7.7.26" }), options).expense_date
    ).toBe("2026-09-09");

    expect(
      buildSlipDraft(makeExtraction({ slip_date: "2026-13-45" }), options).expense_date
    ).toBe("2026-09-09");
  });

  it("keeps a legible slip date", () => {
    expect(buildSlipDraft(makeExtraction(), options).expense_date).toBe("2026-07-07");
  });

  it("survives a slip with no lines at all", () => {
    const draft = buildSlipDraft(makeExtraction({ lines: [] }), options);

    expect(draft.lines).toEqual([]);
    expect(draft.linesTotal).toBe(0);
  });

  it("gives every line a distinct key for the review list", () => {
    const draft = buildSlipDraft(
      makeExtraction({ lines: [makeSlipLine(), makeSlipLine(), makeSlipLine()] }),
      options
    );

    expect(new Set(draft.lines.map((l) => l.id)).size).toBe(3);
  });
});

describe("buildSlipDraft dates on a running page", () => {
  const options = { items, categories, today: "2026-09-09" };

  function datedLine(line_date: string | null, amount: number) {
    return makeSlipLine({ line_date, amount, item_name: "Aaloo" });
  }

  it("gives every line its own date", () => {
    const draft = buildSlipDraft(
      makeExtraction({
        slip_date: null,
        lines: [datedLine("2026-08-31", 950), datedLine("2026-09-01", 395)],
      }),
      options
    );

    expect(draft.lines.map((l) => l.expense_date)).toEqual([
      "2026-08-31",
      "2026-09-01",
    ]);
  });

  it("keeps a page that straddles a month end in both months", () => {
    // The failure this guards against: collapsing onto one date moved August
    // spending into September and skewed every month-over-month figure.
    const draft = buildSlipDraft(
      makeExtraction({
        slip_date: null,
        lines: [datedLine("2026-08-31", 950), datedLine("2026-09-01", 395)],
      }),
      options
    );

    expect(new Set(draft.lines.map((l) => l.expense_date.slice(0, 7)))).toEqual(
      new Set(["2026-08", "2026-09"])
    );
    expect(draft.spansMultipleDates).toBe(true);
  });

  it("carries the last seen date down lines the reader left undated", () => {
    // Ditto marks under a date: the model should carry them, and when it does
    // not, an undated line still belongs to the day above it, not to today.
    const draft = buildSlipDraft(
      makeExtraction({
        slip_date: null,
        lines: [
          datedLine("2026-09-02", 110),
          datedLine(null, 1025),
          datedLine(null, 50),
          datedLine("2026-09-03", 200),
        ],
      }),
      options
    );

    expect(draft.lines.map((l) => l.expense_date)).toEqual([
      "2026-09-02",
      "2026-09-02",
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  it("opens the header on the date most of the lines share", () => {
    const draft = buildSlipDraft(
      makeExtraction({
        slip_date: null,
        lines: [
          datedLine("2026-08-31", 950),
          datedLine("2026-09-01", 10),
          datedLine("2026-09-01", 20),
        ],
      }),
      options
    );

    expect(draft.expense_date).toBe("2026-09-01");
  });

  it("still handles a plain single-day slip", () => {
    const draft = buildSlipDraft(
      makeExtraction({ slip_date: "2026-07-07", lines: [datedLine(null, 40)] }),
      options
    );

    expect(draft.expense_date).toBe("2026-07-07");
    expect(draft.lines[0].expense_date).toBe("2026-07-07");
    expect(draft.spansMultipleDates).toBe(false);
  });

  it("falls back to today for a slip with no dates at all", () => {
    const draft = buildSlipDraft(
      makeExtraction({ slip_date: null, lines: [datedLine(null, 40)] }),
      options
    );

    expect(draft.lines[0].expense_date).toBe("2026-09-09");
  });

  it("ignores a line date it cannot parse rather than storing it", () => {
    const draft = buildSlipDraft(
      makeExtraction({
        slip_date: null,
        lines: [datedLine("2026-09-02", 10), datedLine("2.9.26", 20)],
      }),
      options
    );

    expect(draft.lines[1].expense_date).toBe("2026-09-02");
  });

  it("ignores a date the calendar does not have, which new Date() would roll over", () => {
    const draft = buildSlipDraft(
      makeExtraction({
        slip_date: null,
        lines: [datedLine("2026-08-28", 10), datedLine("2026-02-30", 20)],
      }),
      options
    );

    expect(draft.lines[1].expense_date).toBe("2026-08-28");
  });

  it("flags where a day-first date was read month-first", () => {
    // 1.9.26 read as 9 January, between two September lines.
    const draft = buildSlipDraft(
      makeExtraction({
        slip_date: null,
        lines: [
          datedLine("2026-08-31", 950),
          datedLine("2026-01-09", 395),
          datedLine("2026-09-02", 110),
        ],
      }),
      options
    );

    expect(draft.lines[0].reviewReasons).not.toContain("date-check");
    expect(draft.lines[1].reviewReasons).toContain("date-check");
  });

  it("leaves an ordinary running page unflagged", () => {
    const draft = buildSlipDraft(
      makeExtraction({
        slip_date: null,
        lines: [
          datedLine("2026-08-31", 950),
          datedLine(null, 10),
          datedLine("2026-09-01", 395),
          datedLine("2026-09-03", 110),
        ],
      }),
      options
    );

    expect(draft.lines.flatMap((l) => l.reviewReasons)).not.toContain("date-check");
  });
});

describe("findSuspectDates", () => {
  const today = "2026-09-16";

  it("flags a date in the future, which no slip can carry", () => {
    expect(findSuspectDates(["2026-10-07"], today)).toEqual([true]);
  });

  it("allows a day past the server's UTC today, which is often India's today", () => {
    expect(findSuspectDates(["2026-09-17"], today)).toEqual([false]);
  });

  it("flags only the line where a date goes backwards, not the lines carrying it", () => {
    expect(
      findSuspectDates(["2026-09-07", "2026-09-05", "2026-09-05"], today)
    ).toEqual([false, true, false]);
  });

  it("flags a forward leap too large to be the next entry on a running page", () => {
    const leap = DATE_TUNING.maxForwardJumpDays + 1;
    const later = `2026-08-${String(1 + leap).padStart(2, "0")}`;

    expect(findSuspectDates(["2026-08-01", later], today)).toEqual([false, true]);
    expect(findSuspectDates(["2026-08-01", "2026-08-04"], today)).toEqual([false, false]);
  });

  it("handles a slip with no lines", () => {
    expect(findSuspectDates([], today)).toEqual([]);
  });
});

describe("matchCatalogueItem on slip phrasing", () => {
  const catalogue = [
    makeExpenseItem({ id: "dona", name: "Dona", category: "Religious" }),
    makeExpenseItem({ id: "chai", name: "Chai", category: "Eating Out" }),
    makeExpenseItem({ id: "chaipatti", name: "Chai patti", category: "Groceries" }),
  ];

  it("links a name that opens a longer slip phrase", () => {
    // Seen on a real slip: "दोना के नाऊ को" — the item is Dona, the rest says
    // who it went to.
    expect(matchCatalogueItem("Dona ke nau ke", catalogue)?.item.id).toBe("dona");
  });

  it("still prefers the longer catalogue name when it matches exactly", () => {
    expect(matchCatalogueItem("Chai patti", catalogue)?.item.id).toBe("chaipatti");
  });

  it("does not let a short name claim a phrase it merely appears inside", () => {
    const shortName = [makeExpenseItem({ id: "aam", name: "Aam" })];

    expect(matchCatalogueItem("Badaam ki barfi", shortName)).toBeNull();
  });

  it("needs a whole word, not a shared opening fragment", () => {
    const nuts = [makeExpenseItem({ id: "kaju", name: "Kaju" })];

    expect(matchCatalogueItem("Kajukatli", nuts)).toBeNull();
  });
});
