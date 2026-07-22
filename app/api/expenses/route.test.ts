import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpense, makeExpenseItem } from "@/test/fixtures/expenses";

vi.mock("@/lib/db", () => ({
  getExpenses: vi.fn(),
  getExpenseItems: vi.fn(),
  insertExpense: vi.fn(),
}));

import { getExpenseItems, getExpenses, insertExpense } from "@/lib/db";
import { GET, POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/expenses", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(getExpenses).mockReset();
  vi.mocked(getExpenseItems).mockReset();
  vi.mocked(insertExpense).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/expenses", () => {
  it("filters expenses by the month prefix of expense_date", async () => {
    vi.mocked(getExpenses).mockResolvedValue([
      makeExpense({ expense_date: "2026-07-01", amount: 100 }),
      makeExpense({ expense_date: "2026-06-15", amount: 999 }),
    ]);

    const res = await GET(new Request("http://localhost/api/expenses?month=2026-07"));
    const body = await res.json();

    expect(body.expenses).toHaveLength(1);
    expect(body.total).toBe(100);
  });

  it("defaults to the current month when no query param is given", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    vi.mocked(getExpenses).mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/expenses"));
    const body = await res.json();

    expect(body.month).toBe("2026-07");
  });
});

describe("POST /api/expenses", () => {
  it("derives item_name/category from the matched item in 'pick' mode", async () => {
    vi.mocked(getExpenseItems).mockResolvedValue([
      makeExpenseItem({ id: "item-1", name: "Milk", category: "Groceries" }),
    ]);
    vi.mocked(insertExpense).mockResolvedValue(makeExpense());

    await POST(
      makeRequest({
        expense_date: "2026-07-15",
        mode: "pick",
        item_id: "item-1",
        amount: 60,
        payment_method: "UPI",
      })
    );

    expect(insertExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: "item-1",
        item_name: "Milk",
        category: "Groceries",
        is_itemized: true,
      })
    );
  });

  it("synthesizes the '(mixed)' item_name in 'lump' mode", async () => {
    vi.mocked(insertExpense).mockResolvedValue(makeExpense());

    await POST(
      makeRequest({
        expense_date: "2026-07-15",
        mode: "lump",
        category: "Groceries",
        amount: 500,
        payment_method: "Cash",
      })
    );

    expect(insertExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        item_name: "Groceries (mixed)",
        is_itemized: false,
      })
    );
    expect(getExpenseItems).not.toHaveBeenCalled();
  });

  it("returns a 400 with the classification error when 'pick' mode has no matching item", async () => {
    vi.mocked(getExpenseItems).mockResolvedValue([]);

    const res = await POST(
      makeRequest({
        expense_date: "2026-07-15",
        mode: "pick",
        item_id: "missing",
        amount: 60,
        payment_method: "UPI",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Pick an item, or switch to Other / Lump Sum");
    expect(insertExpense).not.toHaveBeenCalled();
  });

  it.each([["expense_date"], ["payment_method"]])(
    "returns 400 when %s is missing",
    async (field) => {
      const payload: Record<string, unknown> = {
        expense_date: "2026-07-15",
        mode: "lump",
        category: "Groceries",
        amount: 60,
        payment_method: "UPI",
      };
      delete payload[field];

      const res = await POST(makeRequest(payload));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("Missing required fields");
    }
  );

  it("rejects an amount of 0", async () => {
    const res = await POST(
      makeRequest({
        expense_date: "2026-07-15",
        mode: "lump",
        category: "Groceries",
        amount: 0,
        payment_method: "UPI",
      })
    );

    expect(res.status).toBe(400);
  });

  it("rejects a negative amount", async () => {
    const res = await POST(
      makeRequest({
        expense_date: "2026-07-15",
        mode: "lump",
        category: "Groceries",
        amount: -50,
        payment_method: "UPI",
      })
    );

    expect(res.status).toBe(400);
  });
});
