import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTenant } from "@/test/fixtures/tenants";
import { makePayment } from "@/test/fixtures/payments";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({ getTenants: vi.fn(), getPayments: vi.fn() }));

import { getPayments, getTenants } from "@/lib/db";
import { DEFAULT_WINDOW_MONTHS, GET, MAX_WINDOW_MONTHS } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest(query = "", { authed = false } = {}) {
  return new Request(`http://localhost/api/rent-analytics${query}`, {
    headers: authed
      ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken("user")}` }
      : undefined,
  });
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getTenants).mockReset();
  vi.mocked(getPayments).mockReset();
  vi.mocked(getTenants).mockResolvedValue([
    makeTenant({ id: "t1", name: "Asha", security_deposit: 20000 }),
  ]);
  vi.mocked(getPayments).mockResolvedValue([
    makePayment({ tenant_id: "t1", month: "2026-09", paid_on: "2026-09-04" }),
  ]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("GET /api/rent-analytics", () => {
  it("ends at the latest rent month due as of today", async () => {
    const body = await (await GET(makeRequest("", { authed: true }))).json();

    expect(body.months.at(-1)).toMatchObject({
      month: "2026-08",
      expected: 10000,
      collected: 10000,
      onTimeCount: 1,
    });
  });

  it("defaults the window when none is asked for", async () => {
    const body = await (await GET(makeRequest())).json();

    expect(body.months).toHaveLength(DEFAULT_WINDOW_MONTHS);
  });

  it("honours an explicit window and caps an oversized one", async () => {
    const three = await (await GET(makeRequest("?months=3"))).json();
    const huge = await (await GET(makeRequest("?months=9999"))).json();

    expect(three.months.map((m: { month: string }) => m.month)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(huge.months.length).toBeLessThanOrEqual(MAX_WINDOW_MONTHS);
  });

  it("falls back to the default for a nonsense window", async () => {
    for (const query of ["?months=abc", "?months=0", "?months=-4"]) {
      const body = await (await GET(makeRequest(query))).json();
      expect(body.months).toHaveLength(DEFAULT_WINDOW_MONTHS);
    }
  });

  it("keeps totals but withholds anything naming a tenant without a session", async () => {
    const body = await (await GET(makeRequest())).json();

    expect(body.unlocked).toBe(false);
    expect(body.months.at(-1).expected).toBe(10000);
    expect(body.months.at(-1).tenants).toEqual([]);
    expect(body.currentTenants).toEqual([]);
    expect(body.deposits).toBeNull();
    expect(body.alerts).toEqual([]);
  });

  it("includes tenant detail for a user-level session", async () => {
    const body = await (await GET(makeRequest("", { authed: true }))).json();

    expect(body.unlocked).toBe(true);
    expect(body.currentTenants[0]).toMatchObject({ id: "t1", name: "Asha" });
    expect(body.deposits.held).toBe(20000);
  });

  it("returns a controlled 500 when the database fails", async () => {
    vi.mocked(getTenants).mockRejectedValue(new Error("supabase down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to build rent analytics" });

    consoleError.mockRestore();
  });
});
