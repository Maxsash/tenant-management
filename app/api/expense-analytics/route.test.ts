import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpense } from "@/test/fixtures/expenses";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({ getExpenses: vi.fn() }));

import { getExpenses } from "@/lib/db";
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
    // Headline totals stay readable, as on GET /api/expenses.
    expect(body.months.at(-1).total).toBe(250);
  });

  it("includes line-item detail for a user-level session", async () => {
    vi.mocked(getExpenses).mockResolvedValue([
      makeExpense({ expense_date: "2026-09-01", amount: 250 }),
    ]);

    const body = await (await GET(makeRequest("", { authed: true }))).json();

    expect(body.unlocked).toBe(true);
    expect(body.items).toHaveLength(1);
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
