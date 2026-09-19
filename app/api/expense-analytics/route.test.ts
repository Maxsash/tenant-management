import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpense, makeExpenseCategory } from "@/test/fixtures/expenses";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  getExpenses: vi.fn(),
  getExpenseCategories: vi.fn(),
}));

import { getExpenseCategories, getExpenses } from "@/lib/db";
import { DEFAULT_WINDOW_MONTHS, GET, MAX_WINDOW_MONTHS } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest(query = "", { authed = false } = {}) {
  return new Request(`http://localhost/api/expense-analytics${query}`, {
    headers: authed
      ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken("user")}` }
      : undefined,
  });
}

/** One row per month back from August 2026, so a window of N is observable. */
function monthlyRows(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const month = 8 - i;
    return makeExpense({
      id: `row-${i}`,
      expense_date: `2026-${String(month).padStart(2, "0")}-05`,
      amount: 100,
    });
  });
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getExpenses).mockReset();
  vi.mocked(getExpenseCategories).mockReset().mockResolvedValue([]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("GET /api/expense-analytics", () => {
  it("returns the derived series", async () => {
    vi.mocked(getExpenses).mockResolvedValue([
      makeExpense({ expense_date: "2026-09-01", amount: 250 }),
    ]);

    const res = await GET(makeRequest("", { authed: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.months.at(-1)).toMatchObject({
      month: "2026-09",
      total: 250,
      isCurrentMonth: true,
    });
  });

  it("defaults the window when no months are asked for", async () => {
    vi.mocked(getExpenses).mockResolvedValue(monthlyRows(12));

    const body = await (await GET(makeRequest())).json();

    expect(body.months).toHaveLength(DEFAULT_WINDOW_MONTHS);
  });

  it("honours an explicit window", async () => {
    vi.mocked(getExpenses).mockResolvedValue(monthlyRows(12));

    const body = await (await GET(makeRequest("?months=3"))).json();

    expect(body.months.map((m: { month: string }) => m.month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("caps an oversized window instead of trusting the query string", async () => {
    vi.mocked(getExpenses).mockResolvedValue(monthlyRows(2));

    const body = await (await GET(makeRequest("?months=9999"))).json();

    // Capped, and then still trimmed to the months that actually have data.
    expect(body.months.length).toBeLessThanOrEqual(MAX_WINDOW_MONTHS);
    expect(body.months[0].month).toBe("2026-07");
  });

  it("falls back to the default for a nonsense window", async () => {
    vi.mocked(getExpenses).mockResolvedValue(monthlyRows(12));

    for (const query of ["?months=abc", "?months=0", "?months=-4"]) {
      const body = await (await GET(makeRequest(query))).json();
      expect(body.months).toHaveLength(DEFAULT_WINDOW_MONTHS);
    }
  });

  it("withholds line-item detail without a session", async () => {
    vi.mocked(getExpenses).mockResolvedValue([
      makeExpense({ expense_date: "2026-09-01", amount: 250 }),
    ]);

    const body = await (await GET(makeRequest())).json();

    expect(body.unlocked).toBe(false);
    expect(body.items).toEqual([]);
    expect(body.consumption).toEqual([]);
    expect(body.needs).toMatchObject({ shopping: [], paymentRounds: [], lasting: [] });
    // Headline totals stay readable, as on GET /api/expenses.
    expect(body.months.at(-1).total).toBe(250);
  });

  it("includes line-item detail for a user-level session", async () => {
    vi.mocked(getExpenses).mockResolvedValue([
      makeExpense({ id: "milk-1", expense_date: "2026-09-01", amount: 250 }),
      makeExpense({ id: "milk-2", expense_date: "2026-09-05", amount: 260 }),
    ]);

    const body = await (await GET(makeRequest("", { authed: true }))).json();

    expect(body.unlocked).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.needs.lasting).toHaveLength(1);
    expect(body.needs.lasting[0].rhythms[0].history).toHaveLength(2);
    expect(body.needs.lasting[0].learningItems).toEqual([]);
  });

  it("groups the Need again tab in the catalogue's category order", async () => {
    const pair = (name: string, category: string) =>
      [1, 5].map((day) =>
        makeExpense({
          id: `${name}-${day}`,
          expense_date: `2026-09-0${day}`,
          item_id: `item-${name}`,
          item_name: name,
          category,
        })
      );
    vi.mocked(getExpenses).mockResolvedValue([
      ...pair("Milk", "Dairy"),
      ...pair("Suji", "Groceries"),
    ]);
    vi.mocked(getExpenseCategories).mockResolvedValue([
      makeExpenseCategory({ name: "Groceries", sort_order: 0 }),
      makeExpenseCategory({ name: "Dairy", sort_order: 1 }),
    ]);

    const body = await (await GET(makeRequest("", { authed: true }))).json();

    expect(body.needs.lasting.map((g: { category: string }) => g.category)).toEqual([
      "Groceries",
      "Dairy",
    ]);
  });

  it("still answers when the category catalogue cannot be read", async () => {
    vi.mocked(getExpenses).mockResolvedValue([
      makeExpense({ id: "milk-1", expense_date: "2026-09-01" }),
      makeExpense({ id: "milk-2", expense_date: "2026-09-05" }),
    ]);
    vi.mocked(getExpenseCategories).mockRejectedValue(new Error("supabase down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(makeRequest("", { authed: true }));

    expect(res.status).toBe(200);
    expect((await res.json()).needs.lasting).toHaveLength(1);
    consoleError.mockRestore();
  });

  it("returns a controlled 500 when the database fails", async () => {
    vi.mocked(getExpenses).mockRejectedValue(new Error("supabase down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to build expense analytics",
    });

    consoleError.mockRestore();
  });
});
