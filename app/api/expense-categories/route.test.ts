import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpenseCategory } from "@/test/fixtures/expenses";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  getExpenseCategories: vi.fn(),
  insertExpenseCategory: vi.fn(),
}));

import { getExpenseCategories, insertExpenseCategory } from "@/lib/db";
import { GET, POST } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest(body: unknown, { authed = true }: { authed?: boolean } = {}) {
  return new Request("http://localhost/api/expense-categories", {
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
  vi.mocked(getExpenseCategories).mockReset();
  vi.mocked(insertExpenseCategory).mockReset();
});

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("admin session guard", () => {
  it("returns 401 for POST without a valid session", async () => {
    const res = await POST(makeRequest({ name: "Rent" }, { authed: false }));
    expect(res.status).toBe(401);
    expect(insertExpenseCategory).not.toHaveBeenCalled();
  });
});

describe("GET /api/expense-categories", () => {
  it("passes includeInactive=true when all=true", async () => {
    vi.mocked(getExpenseCategories).mockResolvedValue([]);
    await GET(new Request("http://localhost/api/expense-categories?all=true"));
    expect(getExpenseCategories).toHaveBeenCalledWith(true);
  });

  it("defaults to includeInactive=false", async () => {
    vi.mocked(getExpenseCategories).mockResolvedValue([]);
    await GET(new Request("http://localhost/api/expense-categories"));
    expect(getExpenseCategories).toHaveBeenCalledWith(false);
  });
});

describe("POST /api/expense-categories", () => {
  it("defaults icon to the package emoji when omitted", async () => {
    vi.mocked(insertExpenseCategory).mockResolvedValue(makeExpenseCategory());

    await POST(makeRequest({ name: "Rent" }));

    expect(insertExpenseCategory).toHaveBeenCalledWith({
      name: "Rent",
      icon: "📦",
      sort_order: undefined,
    });
  });

  it("forwards an explicit sort_order", async () => {
    vi.mocked(insertExpenseCategory).mockResolvedValue(makeExpenseCategory());

    await POST(makeRequest({ name: "Rent", sort_order: 3 }));

    expect(insertExpenseCategory).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 3 })
    );
  });

  it("rejects a missing name", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects a whitespace-only name", async () => {
    const res = await POST(makeRequest({ name: "   " }));
    expect(res.status).toBe(400);
  });
});
