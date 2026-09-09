import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpenseItem } from "@/test/fixtures/expenses";

vi.mock("@/lib/db", () => ({
  getExpenseItems: vi.fn(),
  insertExpenses: vi.fn(),
}));

import { getExpenseItems, insertExpenses } from "@/lib/db";
import { MAX_BULK_LINES, POST } from "./route";

// Creating expenses is open to everyone, in bulk as much as singly — these
// requests deliberately carry no session cookie.
function makeRequest(body: unknown) {
  return new Request("http://localhost/api/expenses/bulk", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function pickLine(overrides = {}) {
  return { mode: "pick", item_id: "item-1", quantity: 3, unit: "kg", amount: 40, ...overrides };
}

beforeEach(() => {
  vi.mocked(getExpenseItems).mockReset();
  vi.mocked(insertExpenses).mockReset();
  vi.mocked(getExpenseItems).mockResolvedValue([
    makeExpenseItem({ id: "item-1", name: "Aaloo", category: "Vegetables & Fruits" }),
  ]);
  vi.mocked(insertExpenses).mockResolvedValue([]);
});

describe("POST /api/expenses/bulk", () => {
  it("saves every line under one date and payment method", async () => {
    const res = await POST(
      makeRequest({
        expense_date: "2026-07-07",
        payment_method: "Cash",
        lines: [pickLine({ amount: 40 }), pickLine({ amount: 30 })],
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ count: 2 });

    const rows = vi.mocked(insertExpenses).mock.calls[0][0];

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.expense_date === "2026-07-07")).toBe(true);
    expect(rows.every((r) => r.payment_method === "Cash")).toBe(true);
  });

  it("derives each line's name and category from the catalogue", async () => {
    await POST(
      makeRequest({
        expense_date: "2026-07-07",
        payment_method: "Cash",
        lines: [pickLine()],
      })
    );

    expect(vi.mocked(insertExpenses).mock.calls[0][0][0]).toMatchObject({
      item_id: "item-1",
      item_name: "Aaloo",
      category: "Vegetables & Fruits",
      is_itemized: true,
    });
  });

  it("accepts free-text and lump-sum lines alongside catalogue ones", async () => {
    await POST(
      makeRequest({
        expense_date: "2026-07-07",
        payment_method: "Cash",
        lines: [
          { mode: "custom", custom_name: "Chironji", category: "Groceries", amount: 120 },
          { mode: "lump", category: "Groceries", amount: 500 },
        ],
      })
    );

    const rows = vi.mocked(insertExpenses).mock.calls[0][0];

    expect(rows[0]).toMatchObject({ item_name: "Chironji", is_itemized: true });
    expect(rows[1]).toMatchObject({ item_name: "Groceries (mixed)", is_itemized: false });
  });

  it("writes nothing when any single line is invalid", async () => {
    const res = await POST(
      makeRequest({
        expense_date: "2026-07-07",
        payment_method: "Cash",
        lines: [pickLine(), { mode: "custom", custom_name: "", category: "Groceries", amount: 10 }],
      })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ lineIndex: 1 });
    expect(insertExpenses).not.toHaveBeenCalled();
  });

  it("names the offending line in the error, counting from one", async () => {
    const res = await POST(
      makeRequest({
        expense_date: "2026-07-07",
        payment_method: "Cash",
        lines: [pickLine(), pickLine({ amount: 0 })],
      })
    );

    expect((await res.json()).error).toContain("Line 2");
    expect(insertExpenses).not.toHaveBeenCalled();
  });

  it("rejects a request with no date or payment method", async () => {
    const noDate = await POST(
      makeRequest({ payment_method: "Cash", lines: [pickLine()] })
    );
    const noMethod = await POST(
      makeRequest({ expense_date: "2026-07-07", lines: [pickLine()] })
    );

    expect(noDate.status).toBe(400);
    expect(noMethod.status).toBe(400);
  });

  it("rejects an empty or missing line list", async () => {
    const empty = await POST(
      makeRequest({ expense_date: "2026-07-07", payment_method: "Cash", lines: [] })
    );
    const missing = await POST(
      makeRequest({ expense_date: "2026-07-07", payment_method: "Cash" })
    );

    expect(empty.status).toBe(400);
    expect(missing.status).toBe(400);
  });

  it("refuses a batch longer than one real slip could be", async () => {
    const res = await POST(
      makeRequest({
        expense_date: "2026-07-07",
        payment_method: "Cash",
        lines: Array.from({ length: MAX_BULK_LINES + 1 }, () => pickLine()),
      })
    );

    expect(res.status).toBe(400);
    expect(insertExpenses).not.toHaveBeenCalled();
  });

  it("turns malformed JSON into a 400 rather than an unhandled throw", async () => {
    const res = await POST(makeRequest("{ not json"));

    expect(res.status).toBe(400);
  });

  it("does not read the catalogue when no line needs it", async () => {
    await POST(
      makeRequest({
        expense_date: "2026-07-07",
        payment_method: "Cash",
        lines: [{ mode: "lump", category: "Groceries", amount: 500 }],
      })
    );

    expect(getExpenseItems).not.toHaveBeenCalled();
  });

  it("reports a database failure as a 500 with its message", async () => {
    vi.mocked(insertExpenses).mockRejectedValue(new Error("connection lost"));

    const res = await POST(
      makeRequest({
        expense_date: "2026-07-07",
        payment_method: "Cash",
        lines: [pickLine()],
      })
    );

    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("connection lost");
  });
});
