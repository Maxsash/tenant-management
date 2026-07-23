import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTenant } from "@/test/fixtures/tenants";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  getPayments: vi.fn(),
  getTenants: vi.fn(),
}));

import { getPayments, getTenants } from "@/lib/db";
import { GET } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function callGet(id: string, { authed = true }: { authed?: boolean } = {}) {
  return GET(
    new Request(`http://localhost/api/tenant-payments/${id}`, {
      headers: authed ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken()}` } : undefined,
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getPayments).mockReset();
  vi.mocked(getTenants).mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("admin session guard", () => {
  it("returns 401 without a valid session, without touching the DB", async () => {
    const res = await callGet("t1", { authed: false });

    expect(res.status).toBe(401);
    expect(getTenants).not.toHaveBeenCalled();
  });
});

describe("GET /api/tenant-payments/[id]", () => {
  it("returns 404 when the tenant doesn't exist", async () => {
    vi.mocked(getTenants).mockResolvedValue([]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await callGet("missing");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Tenant not found" });
  });

  it("excludes a payment before the global cutoff (2023-12) and includes one exactly at it", async () => {
    const tenant = makeTenant({ id: "t1", tenant_since: "2020-01-01" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([
      { tenant_id: "t1", month: "2023-11", paid_on: "2023-11-05" },
      { tenant_id: "t1", month: "2023-12", paid_on: "2023-12-05" },
    ]);

    const res = await callGet("t1");
    const body = await res.json();

    expect(body.payments).toHaveLength(1);
    expect(body.payments[0].payment_month).toBe("2023-12");
  });

  it("excludes a row with a falsy raw month, even if payment_month is derived", async () => {
    const tenant = makeTenant({ id: "t1" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([
      { tenant_id: "t1", month: null, payment_month: "2026-07", rent_month: "2026-06", paid_on: "2026-07-03" },
    ]);

    const res = await callGet("t1");
    const body = await res.json();

    expect(body.payments).toHaveLength(0);
  });

  it("sorts payments newest-first by paid_on", async () => {
    const tenant = makeTenant({ id: "t1" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([
      { tenant_id: "t1", month: "2026-06", paid_on: "2026-06-03" },
      { tenant_id: "t1", month: "2026-07", paid_on: "2026-07-03" },
    ]);

    const res = await callGet("t1");
    const body = await res.json();

    expect(body.payments.map((p: { payment_month: string }) => p.payment_month)).toEqual([
      "2026-07",
      "2026-06",
    ]);
  });

  it("falls back to the payment_month for sorting when paid_on is absent", async () => {
    const tenant = makeTenant({ id: "t1" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([
      { tenant_id: "t1", month: "2026-05" },
      { tenant_id: "t1", month: "2026-07", paid_on: "2026-07-03" },
    ]);

    const res = await callGet("t1");
    const body = await res.json();

    expect(body.payments.map((p: { payment_month: string }) => p.payment_month)).toEqual([
      "2026-07",
      "2026-05",
    ]);
  });

  it("documents that two rows missing an id both fall back to the same Date.now()-based id", async () => {
    const tenant = makeTenant({ id: "t1" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([
      { tenant_id: "t1", month: "2026-06", paid_on: "2026-06-03" },
      { tenant_id: "t1", month: "2026-07", paid_on: "2026-07-03" },
    ]);

    const res = await callGet("t1");
    const body = await res.json();

    // Not a desired behavior — just documenting the current collision risk
    // rather than fixing it in this pass.
    expect(body.payments[0].id).toBe(body.payments[1].id);
  });

  it("starts the monthly breakdown at tenant_since when it's after the global cutoff", async () => {
    const tenant = makeTenant({ id: "t1", tenant_since: "2026-04-15" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await callGet("t1");
    const body = await res.json();

    // "now" is fixed at 2026-07-15, so the current month (07) isn't due yet;
    // the breakdown covers up to 2026-06, starting from tenant_since's month.
    expect(body.monthlyBreakdown.map((m: { month: string }) => m.month)).toEqual([
      "2026-06",
      "2026-05",
      "2026-04",
    ]);
  });

  it("falls back to the global cutoff as the breakdown start when tenant_since predates it", async () => {
    const tenant = makeTenant({ id: "t1", tenant_since: "2020-01-01" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await callGet("t1");
    const body = await res.json();

    const oldest = body.monthlyBreakdown[body.monthlyBreakdown.length - 1];
    expect(oldest.month).toBe("2023-12");
  });

  it("excludes the current calendar month from the breakdown (rent isn't due yet)", async () => {
    const tenant = makeTenant({ id: "t1", tenant_since: "2026-04-15" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await callGet("t1");
    const body = await res.json();

    expect(body.monthlyBreakdown.some((m: { month: string }) => m.month === "2026-07")).toBe(
      false
    );
  });

  describe("summary", () => {
    it("computes totalPaid/totalPending/onTimeCount/latePaymentCount/onTimePercentage from a small breakdown", async () => {
      const tenant = makeTenant({ id: "t1", tenant_since: "2026-05-01", base_rent: 10000 });
      vi.mocked(getTenants).mockResolvedValue([tenant]);
      vi.mocked(getPayments).mockResolvedValue([
        // rent for May (rent_month 2026-05) paid on time in June
        { tenant_id: "t1", month: "2026-06", rent_month: "2026-05", paid_on: "2026-06-03" },
        // rent for June (rent_month 2026-06) paid late in July
        { tenant_id: "t1", month: "2026-07", rent_month: "2026-06", paid_on: "2026-07-15" },
      ]);

      const res = await callGet("t1");
      const body = await res.json();

      expect(body.monthlyBreakdown).toHaveLength(2); // 2026-05, 2026-06
      expect(body.summary.totalPaid).toBe(20000);
      expect(body.summary.totalPending).toBe(0);
      expect(body.summary.onTimeCount).toBe(1);
      expect(body.summary.latePaymentCount).toBe(1);
      expect(body.summary.totalExpected).toBe(2);
      expect(body.summary.onTimePercentage).toBe(50);
      expect(body.summary.averagePaymentAmount).toBe(10000);
    });

    it("returns zeroed summary fields when there are no payments at all", async () => {
      const tenant = makeTenant({ id: "t1", tenant_since: "2026-06-01" });
      vi.mocked(getTenants).mockResolvedValue([tenant]);
      vi.mocked(getPayments).mockResolvedValue([]);

      const res = await callGet("t1");
      const body = await res.json();

      expect(body.summary.onTimeCount).toBe(0);
      expect(body.summary.latePaymentCount).toBe(0);
      expect(body.summary.onTimePercentage).toBe(0);
      expect(body.summary.averagePaymentAmount).toBe(0);
      expect(body.summary.totalPending).toBeGreaterThan(0);
    });
  });

  it("catches a thrown error and returns a controlled 500", async () => {
    vi.mocked(getTenants).mockRejectedValue(new Error("db down"));

    const res = await callGet("t1");
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch payment history" });
  });

  it("lastPaymentDate reflects the truly most recent payment, not just the most recent 'paid' one", async () => {
    const tenant = makeTenant({ id: "t1", tenant_since: "2026-04-01" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([
      // rent for April, paid on time in May
      { tenant_id: "t1", month: "2026-05", rent_month: "2026-04", paid_on: "2026-05-03" },
      // rent for May, paid LATE in June — this is the truly most recent payment
      { tenant_id: "t1", month: "2026-06", rent_month: "2026-05", paid_on: "2026-06-20" },
    ]);

    const res = await callGet("t1");
    const body = await res.json();

    expect(body.summary.lastPaymentDate).toBe("2026-06-20");
  });
});
