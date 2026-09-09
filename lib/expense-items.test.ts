import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUGGESTION_LIMIT,
  rankItemsByUsage,
  suggestItems,
} from "@/lib/expense-items";
import { makeExpense, makeExpenseItem } from "@/test/fixtures/expenses";

const TODAY = "2026-09-09";

const milk = makeExpenseItem({ id: "milk", name: "Milk" });
const atta = makeExpenseItem({ id: "atta", name: "Atta" });
const ghee = makeExpenseItem({ id: "ghee", name: "Ghee" });

describe("rankItemsByUsage", () => {
  it("puts what gets bought most at the top", () => {
    const ranked = rankItemsByUsage(
      [ghee, milk],
      [
        makeExpense({ id: "1", item_id: "milk", expense_date: "2026-09-08" }),
        makeExpense({ id: "2", item_id: "milk", expense_date: "2026-09-05" }),
        makeExpense({ id: "3", item_id: "ghee", expense_date: "2026-09-01" }),
      ],
      TODAY
    );

    expect(ranked.map((r) => r.item.id)).toEqual(["milk", "ghee"]);
  });

  it("weights a recent purchase above an old one", () => {
    const ranked = rankItemsByUsage(
      [milk, atta],
      [
        // Two buys last year outweighed by one this month.
        makeExpense({ id: "1", item_id: "atta", expense_date: "2025-09-01" }),
        makeExpense({ id: "2", item_id: "atta", expense_date: "2025-10-01" }),
        makeExpense({ id: "3", item_id: "milk", expense_date: "2026-09-08" }),
      ],
      TODAY
    );

    expect(ranked[0].item.id).toBe("milk");
  });

  it("ignores free-text rows that never linked to the catalogue", () => {
    const ranked = rankItemsByUsage(
      [milk],
      [
        makeExpense({ id: "1", item_id: null, item_name: "Milk", expense_date: "2026-09-08" }),
      ],
      TODAY
    );

    expect(ranked[0].score).toBe(0);
    expect(ranked[0].lastUsed).toBeNull();
  });

  it("records the most recent purchase date, whatever order rows arrive in", () => {
    const ranked = rankItemsByUsage(
      [milk],
      [
        makeExpense({ id: "1", item_id: "milk", expense_date: "2026-07-01" }),
        makeExpense({ id: "2", item_id: "milk", expense_date: "2026-09-08" }),
        makeExpense({ id: "3", item_id: "milk", expense_date: "2026-08-01" }),
      ],
      TODAY
    );

    expect(ranked[0].lastUsed).toBe("2026-09-08");
  });

  it("keeps never-bought items in the list, scored zero and sorted last", () => {
    const ranked = rankItemsByUsage(
      [ghee, milk, atta],
      [makeExpense({ id: "1", item_id: "milk", expense_date: "2026-09-08" })],
      TODAY
    );

    expect(ranked[0].item.id).toBe("milk");
    // The unbought pair falls back to alphabetical, so the list stays stable.
    expect(ranked.slice(1).map((r) => r.item.name)).toEqual(["Atta", "Ghee"]);
  });

  it("does not let an unparseable or future date top the list", () => {
    const ranked = rankItemsByUsage(
      [milk, atta],
      [
        makeExpense({ id: "1", item_id: "atta", expense_date: "not-a-date" }),
        makeExpense({ id: "2", item_id: "atta", expense_date: "2027-01-01" }),
        makeExpense({ id: "3", item_id: "milk", expense_date: "2026-09-08" }),
      ],
      TODAY
    );

    expect(ranked[0].item.id).toBe("milk");
  });
});

describe("suggestItems", () => {
  it("returns nothing at all for a household with no history", () => {
    expect(suggestItems([milk, atta], [], TODAY)).toEqual([]);
  });

  it("offers only items actually bought", () => {
    const suggested = suggestItems(
      [milk, atta, ghee],
      [makeExpense({ id: "1", item_id: "milk", expense_date: "2026-09-08" })],
      TODAY
    );

    expect(suggested.map((i) => i.id)).toEqual(["milk"]);
  });

  it("caps the shortlist", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeExpenseItem({ id: `item-${i}`, name: `Item ${i}` })
    );

    const expenses = many.map((item, i) =>
      makeExpense({ id: `e-${i}`, item_id: item.id, expense_date: "2026-09-08" })
    );

    expect(suggestItems(many, expenses, TODAY)).toHaveLength(DEFAULT_SUGGESTION_LIMIT);
    expect(suggestItems(many, expenses, TODAY, 5)).toHaveLength(5);
  });
});
