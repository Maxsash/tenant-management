import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpenseCategory } from "@/test/fixtures/expenses";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  deleteExpenseCategory: vi.fn(),
  getExpenseCategoryById: vi.fn(),
  isExpenseCategoryInUse: vi.fn(),
  updateExpenseCategory: vi.fn(),
}));

import {
  deleteExpenseCategory,
  getExpenseCategoryById,
  isExpenseCategoryInUse,
  updateExpenseCategory,
} from "@/lib/db";
import { DELETE, PATCH } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function authedHeaders() {
  return { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken()}` };
}

function callPatch(body: unknown, { authed = true }: { authed?: boolean } = {}) {
  return PATCH(
    new Request("http://localhost/api/expense-categories/c1", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", ...(authed ? authedHeaders() : {}) },
    }),
    { params: Promise.resolve({ id: "c1" }) }
  );
}

function callDelete({ authed = true }: { authed?: boolean } = {}) {
  return DELETE(
    new Request("http://localhost/api/expense-categories/c1", {
      method: "DELETE",
      headers: authed ? authedHeaders() : undefined,
    }),
    { params: Promise.resolve({ id: "c1" }) }
  );
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(updateExpenseCategory).mockReset();
  vi.mocked(getExpenseCategoryById).mockReset();
  vi.mocked(isExpenseCategoryInUse).mockReset();
  vi.mocked(deleteExpenseCategory).mockReset();
});

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("admin session guard", () => {
  it("returns 401 for PATCH without a valid session", async () => {
    const res = await callPatch({ active: false }, { authed: false });
    expect(res.status).toBe(401);
    expect(updateExpenseCategory).not.toHaveBeenCalled();
  });

  it("returns 401 for DELETE without a valid session", async () => {
    const res = await callDelete({ authed: false });
    expect(res.status).toBe(401);
    expect(deleteExpenseCategory).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/expense-categories/[id]", () => {
  it("forwards only the fields present in the body", async () => {
    vi.mocked(updateExpenseCategory).mockResolvedValue(makeExpenseCategory());
    await callPatch({ active: false });
    expect(updateExpenseCategory).toHaveBeenCalledWith("c1", { active: false });
  });

  it("rejects a whitespace-only name", async () => {
    const res = await callPatch({ name: "   " });
    expect(res.status).toBe(400);
    expect(updateExpenseCategory).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/expense-categories/[id]", () => {
  it("returns 404 when the category doesn't exist, short-circuiting before the in-use check", async () => {
    vi.mocked(getExpenseCategoryById).mockResolvedValue(null);

    const res = await callDelete();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Category not found" });
    expect(isExpenseCategoryInUse).not.toHaveBeenCalled();
    expect(deleteExpenseCategory).not.toHaveBeenCalled();
  });

  it("blocks deletion when in use", async () => {
    vi.mocked(getExpenseCategoryById).mockResolvedValue(makeExpenseCategory({ name: "Rent" }));
    vi.mocked(isExpenseCategoryInUse).mockResolvedValue(true);

    const res = await callDelete();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/can't be deleted/);
    expect(deleteExpenseCategory).not.toHaveBeenCalled();
  });

  it("deletes when found and not in use", async () => {
    vi.mocked(getExpenseCategoryById).mockResolvedValue(makeExpenseCategory({ name: "Rent" }));
    vi.mocked(isExpenseCategoryInUse).mockResolvedValue(false);
    vi.mocked(deleteExpenseCategory).mockResolvedValue(undefined);

    const res = await callDelete();
    const body = await res.json();

    expect(body).toEqual({ ok: true });
    expect(isExpenseCategoryInUse).toHaveBeenCalledWith("Rent");
  });
});
