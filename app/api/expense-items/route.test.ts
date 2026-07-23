import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpenseItem } from "@/test/fixtures/expenses";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  getExpenseItems: vi.fn(),
  insertExpenseItem: vi.fn(),
}));

import { getExpenseItems, insertExpenseItem } from "@/lib/db";
import { GET, POST } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest(body: unknown, { authed = true }: { authed?: boolean } = {}) {
  return new Request("http://localhost/api/expense-items", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(authed ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken()}` } : {}),
    },
  });
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getExpenseItems).mockReset();
  vi.mocked(insertExpenseItem).mockReset();
});

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("admin session guard", () => {
  it("returns 401 for POST without a valid session", async () => {
    const res = await POST(makeRequest({ name: "Milk", category: "Groceries" }, { authed: false }));
    expect(res.status).toBe(401);
    expect(insertExpenseItem).not.toHaveBeenCalled();
  });
});

describe("GET /api/expense-items", () => {
  it("passes includeInactive=true when all=true", async () => {
    vi.mocked(getExpenseItems).mockResolvedValue([]);
    await GET(new Request("http://localhost/api/expense-items?all=true"));
    expect(getExpenseItems).toHaveBeenCalledWith(true);
  });

  it("defaults to includeInactive=false", async () => {
    vi.mocked(getExpenseItems).mockResolvedValue([]);
    await GET(new Request("http://localhost/api/expense-items"));
    expect(getExpenseItems).toHaveBeenCalledWith(false);
  });
});

describe("POST /api/expense-items", () => {
  it("creates an item with a default_unit fallback of null", async () => {
    vi.mocked(insertExpenseItem).mockResolvedValue(makeExpenseItem());

    await POST(makeRequest({ name: "Milk", category: "Groceries" }));

    expect(insertExpenseItem).toHaveBeenCalledWith({
      name: "Milk",
      category: "Groceries",
      default_unit: null,
    });
  });

  it("rejects a missing name", async () => {
    const res = await POST(makeRequest({ category: "Groceries" }));
    expect(res.status).toBe(400);
  });

  it("rejects a whitespace-only name", async () => {
    const res = await POST(makeRequest({ name: "   ", category: "Groceries" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing category", async () => {
    const res = await POST(makeRequest({ name: "Milk" }));
    expect(res.status).toBe(400);
  });
});
