import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpense, makeExpenseItem } from "@/test/fixtures/expenses";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  deleteExpense: vi.fn(),
  getExpenseItems: vi.fn(),
  updateExpense: vi.fn(),
}));

import { deleteExpense, getExpenseItems, updateExpense } from "@/lib/db";
import { DELETE, PATCH } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest(
  method: string,
  body?: unknown,
  { authed = true }: { authed?: boolean } = {}
) {
  return new Request("http://localhost/api/expenses/e1", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(authed ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken("admin")}` } : {}),
    },
  });
}

function callPatch(body: unknown, opts?: { authed?: boolean }) {
  return PATCH(makeRequest("PATCH", body, opts), { params: Promise.resolve({ id: "e1" }) });
}

function callDelete(opts?: { authed?: boolean }) {
  return DELETE(makeRequest("DELETE", undefined, opts), {
    params: Promise.resolve({ id: "e1" }),
  });
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(updateExpense).mockReset();
  vi.mocked(getExpenseItems).mockReset();
  vi.mocked(deleteExpense).mockReset();
});

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("admin session guard", () => {
  it("returns 401 for PATCH without a valid session", async () => {
    const res = await callPatch({ notes: "x" }, { authed: false });
    expect(res.status).toBe(401);
    expect(updateExpense).not.toHaveBeenCalled();
  });

  it("returns 401 for DELETE without a valid session", async () => {
    const res = await callDelete({ authed: false });
    expect(res.status).toBe(401);
    expect(deleteExpense).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/expenses/[id]", () => {
  it("only forwards fields present in the body", async () => {
    vi.mocked(updateExpense).mockResolvedValue(makeExpense());

    await callPatch({ notes: "updated note" });

    expect(updateExpense).toHaveBeenCalledWith("e1", { notes: "updated note" });
  });

  it("allows an explicit null through for a nullable field", async () => {
    vi.mocked(updateExpense).mockResolvedValue(makeExpense());

    await callPatch({ notes: null });

    expect(updateExpense).toHaveBeenCalledWith("e1", { notes: null });
  });

  it("re-derives classification fields when mode is present", async () => {
    vi.mocked(getExpenseItems).mockResolvedValue([
      makeExpenseItem({ id: "item-2", name: "Bread", category: "Groceries" }),
    ]);
    vi.mocked(updateExpense).mockResolvedValue(makeExpense());

    await callPatch({ mode: "pick", item_id: "item-2" });

    expect(updateExpense).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ item_id: "item-2", item_name: "Bread", category: "Groceries" })
    );
  });

  it("returns 400 with the classification error when re-derivation fails", async () => {
    vi.mocked(getExpenseItems).mockResolvedValue([]);

    const res = await callPatch({ mode: "pick", item_id: "missing" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Pick an item, or switch to Other / Lump Sum");
    expect(updateExpense).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount", async () => {
    const res = await callPatch({ amount: 0 });
    expect(res.status).toBe(400);
    expect(updateExpense).not.toHaveBeenCalled();
  });

  it("rejects a negative amount", async () => {
    const res = await callPatch({ amount: -10 });
    expect(res.status).toBe(400);
  });

  it("accepts a valid positive amount", async () => {
    vi.mocked(updateExpense).mockResolvedValue(makeExpense());

    await callPatch({ amount: 150 });

    expect(updateExpense).toHaveBeenCalledWith("e1", { amount: 150 });
  });
});

describe("DELETE /api/expenses/[id]", () => {
  it("deletes and returns ok", async () => {
    vi.mocked(deleteExpense).mockResolvedValue(undefined);

    const res = await callDelete();
    const body = await res.json();

    expect(body).toEqual({ ok: true });
  });

  it("succeeds even if the row didn't exist (documented as an accepted no-op, not a bug)", async () => {
    vi.mocked(deleteExpense).mockResolvedValue(undefined);

    const res = await callDelete();

    expect(res.status).toBe(200);
  });
});
