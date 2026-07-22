import { describe, expect, it } from "vitest";
import { buildExpenseSummary } from "./expense-summary";
import { makeExpense } from "@/test/fixtures/expenses";

describe("buildExpenseSummary", () => {
  it("returns zero total and no category totals for an empty list", () => {
    expect(buildExpenseSummary([])).toEqual({ total: 0, categoryTotals: [] });
  });

  it("sums a single category across multiple expenses", () => {
    const expenses = [
      makeExpense({ category: "Groceries", amount: 100 }),
      makeExpense({ category: "Groceries", amount: 50 }),
    ];

    const summary = buildExpenseSummary(expenses);

    expect(summary.total).toBe(150);
    expect(summary.categoryTotals).toEqual([{ category: "Groceries", amount: 150, pct: 100 }]);
  });

  it("sorts categoryTotals descending by amount, regardless of input order", () => {
    const expenses = [
      makeExpense({ category: "Utilities", amount: 20 }),
      makeExpense({ category: "Groceries", amount: 100 }),
      makeExpense({ category: "Transport", amount: 50 }),
    ];

    const summary = buildExpenseSummary(expenses);

    expect(summary.categoryTotals.map((c) => c.category)).toEqual([
      "Groceries",
      "Transport",
      "Utilities",
    ]);
  });

  it("keeps stable (insertion) order for tied amounts, rather than an alphabetical tiebreak", () => {
    const expenses = [
      makeExpense({ category: "Zeta", amount: 50 }),
      makeExpense({ category: "Alpha", amount: 50 }),
    ];

    const summary = buildExpenseSummary(expenses);

    expect(summary.categoryTotals.map((c) => c.category)).toEqual(["Zeta", "Alpha"]);
  });

  it("silently treats a malformed amount as 0 rather than throwing", () => {
    const expenses = [
      makeExpense({ category: "Groceries", amount: "not-a-number" as unknown as number }),
    ];

    const summary = buildExpenseSummary(expenses);

    expect(summary.total).toBe(0);
    expect(summary.categoryTotals).toEqual([{ category: "Groceries", amount: 0, pct: 0 }]);
  });

  it("does not reject negative amounts (validation is the API layer's job, not this function's)", () => {
    const expenses = [makeExpense({ category: "Groceries", amount: -50 })];

    const summary = buildExpenseSummary(expenses);

    expect(summary.total).toBe(-50);
    expect(summary.categoryTotals[0].amount).toBe(-50);
  });

  it("computes pct as the category's share of the total, rounded", () => {
    const expenses = [
      makeExpense({ category: "Groceries", amount: 75 }),
      makeExpense({ category: "Transport", amount: 25 }),
    ];

    const summary = buildExpenseSummary(expenses);

    expect(summary.categoryTotals.find((c) => c.category === "Groceries")?.pct).toBe(75);
    expect(summary.categoryTotals.find((c) => c.category === "Transport")?.pct).toBe(25);
  });

  it("does not divide by zero when total is 0", () => {
    const expenses = [makeExpense({ category: "Groceries", amount: 0 })];

    const summary = buildExpenseSummary(expenses);

    expect(summary.categoryTotals[0].pct).toBe(0);
  });
});
