import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpenseItem } from "@/test/fixtures/expenses";

vi.mock("@/lib/db", () => ({
  deleteExpenseItem: vi.fn(),
  isExpenseItemInUse: vi.fn(),
  updateExpenseItem: vi.fn(),
}));

import { deleteExpenseItem, isExpenseItemInUse, updateExpenseItem } from "@/lib/db";
import { DELETE, PATCH } from "./route";

function callPatch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/expense-items/i1", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "i1" }) }
  );
}

function callDelete() {
  return DELETE(new Request("http://localhost/api/expense-items/i1", { method: "DELETE" }), {
    params: Promise.resolve({ id: "i1" }),
  });
}

beforeEach(() => {
  vi.mocked(updateExpenseItem).mockReset();
  vi.mocked(isExpenseItemInUse).mockReset();
  vi.mocked(deleteExpenseItem).mockReset();
});

describe("PATCH /api/expense-items/[id]", () => {
  it("forwards only the fields present in the body, including active toggling", async () => {
    vi.mocked(updateExpenseItem).mockResolvedValue(makeExpenseItem());
    await callPatch({ active: false });
    expect(updateExpenseItem).toHaveBeenCalledWith("i1", { active: false });
  });

  it("rejects a whitespace-only name", async () => {
    const res = await callPatch({ name: "   " });
    expect(res.status).toBe(400);
    expect(updateExpenseItem).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/expense-items/[id]", () => {
  it("blocks deletion and does not call deleteExpenseItem when in use", async () => {
    vi.mocked(isExpenseItemInUse).mockResolvedValue(true);

    const res = await callDelete();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/can't be deleted/);
    expect(deleteExpenseItem).not.toHaveBeenCalled();
  });

  it("deletes when not in use", async () => {
    vi.mocked(isExpenseItemInUse).mockResolvedValue(false);
    vi.mocked(deleteExpenseItem).mockResolvedValue(undefined);

    const res = await callDelete();
    const body = await res.json();

    expect(body).toEqual({ ok: true });
    expect(deleteExpenseItem).toHaveBeenCalledWith("i1");
  });
});
