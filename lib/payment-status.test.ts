import { describe, expect, it } from "vitest";
import { buildPaymentHistory, evaluatePaymentStatus } from "./payment-status";
import { makeTenant } from "@/test/fixtures/tenants";
import { makePayment } from "@/test/fixtures/payments";

describe("evaluatePaymentStatus", () => {
  it("is 'paid' when paid on or before the due date (day 7 of the following month)", () => {
    const tenant = makeTenant();
    const payments = [makePayment({ month: "2026-07", paid_on: "2026-07-03" })];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.status).toBe("paid");
    expect(result.isLate).toBe(false);
  });

  it("is exactly on-time when paid on day 7 itself (boundary)", () => {
    const tenant = makeTenant();
    const payments = [makePayment({ month: "2026-07", paid_on: "2026-07-07" })];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.status).toBe("paid");
    expect(result.isLate).toBe(false);
  });

  it("is 'late' when paid on day 8 (one day past the boundary)", () => {
    const tenant = makeTenant();
    const payments = [makePayment({ month: "2026-07", paid_on: "2026-07-08" })];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.status).toBe("late");
    expect(result.isLate).toBe(true);
  });

  it("respects a custom onTimeDayLimit", () => {
    const tenant = makeTenant();
    const payments = [makePayment({ month: "2026-07", paid_on: "2026-07-10" })];

    const result = evaluatePaymentStatus({
      tenant,
      payments,
      rentMonth: "2026-06",
      onTimeDayLimit: 10,
    });

    expect(result.status).toBe("paid");
  });

  it("is 'pending' when no payment matches the tenant/month", () => {
    const tenant = makeTenant();
    const result = evaluatePaymentStatus({ tenant, payments: [], rentMonth: "2026-07" });

    expect(result.status).toBe("pending");
    expect(result.paid_on).toBeNull();
    expect(result.payment).toBeNull();
  });

  it("is 'pending' when the matching payment has no paid_on", () => {
    const tenant = makeTenant();
    const payments = [makePayment({ month: "2026-07", paid_on: undefined })];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.status).toBe("pending");
  });

  it("matches via a pre-computed rent_month field when present", () => {
    const tenant = makeTenant();
    const payments = [
      { ...makePayment({ paid_on: "2026-07-03" }), rent_month: "2026-06" },
    ];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.status).toBe("paid");
  });

  it("derives rent_month from payment_month/month when rent_month is absent", () => {
    const tenant = makeTenant();
    const payments = [makePayment({ month: "2026-07", paid_on: "2026-07-03" })];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.status).toBe("paid");
  });

  it("ignores a payment belonging to a different tenant", () => {
    const tenant = makeTenant({ id: "tenant-1" });
    const payments = [
      makePayment({ tenant_id: "tenant-2", month: "2026-07", paid_on: "2026-07-03" }),
    ];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.status).toBe("pending");
  });

  it("picks the matching payment out of several unrelated ones", () => {
    const tenant = makeTenant({ id: "tenant-1" });
    const payments = [
      makePayment({ tenant_id: "tenant-2", month: "2026-07", paid_on: "2026-07-03" }),
      makePayment({ tenant_id: "tenant-1", month: "2026-08", paid_on: "2026-08-03" }),
      makePayment({ tenant_id: "tenant-1", month: "2026-07", paid_on: "2026-07-05" }),
    ];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.paid_on).toBe("2026-07-05");
  });

  it("rejects a rentMonth without a zero-padded month (stricter than lib/rent.ts's parsing)", () => {
    const tenant = makeTenant();
    const result = evaluatePaymentStatus({ tenant, payments: [], rentMonth: "2026-7" });

    expect(result.status).toBe("pending");
  });

  it("rejects an out-of-range rentMonth month", () => {
    const tenant = makeTenant();
    const result = evaluatePaymentStatus({ tenant, payments: [], rentMonth: "2026-13" });

    expect(result.status).toBe("pending");
  });

  it("falls back to pending when paid_on is malformed", () => {
    const tenant = makeTenant();
    const payments = [makePayment({ month: "2026-07", paid_on: "not-a-date" })];

    const result = evaluatePaymentStatus({ tenant, payments, rentMonth: "2026-06" });

    expect(result.status).toBe("pending");
  });
});

describe("buildPaymentHistory", () => {
  it("builds a chronological history across a multi-month range", () => {
    const tenant = makeTenant();
    const payments = [
      makePayment({ month: "2026-06", paid_on: "2026-06-03" }), // rent_month 2026-05
      makePayment({ month: "2026-07", paid_on: "2026-07-03" }), // rent_month 2026-06
    ];

    const history = buildPaymentHistory({
      tenant,
      payments,
      fromMonth: "2026-05",
      toMonth: "2026-07",
    });

    expect(history.map((h) => h.month)).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(history[0].status).toBe("paid");
    expect(history[1].status).toBe("paid");
    expect(history[2].status).toBe("pending");
  });

  it("returns a single-element array when fromMonth === toMonth", () => {
    const tenant = makeTenant();
    const history = buildPaymentHistory({
      tenant,
      payments: [],
      fromMonth: "2026-06",
      toMonth: "2026-06",
    });

    expect(history).toHaveLength(1);
    expect(history[0].month).toBe("2026-06");
  });

  it("returns [] when fromMonth is after toMonth", () => {
    const tenant = makeTenant();
    const history = buildPaymentHistory({
      tenant,
      payments: [],
      fromMonth: "2026-08",
      toMonth: "2026-06",
    });

    expect(history).toEqual([]);
  });

  it("returns [] when either bound fails the YYYY-MM format check", () => {
    const tenant = makeTenant();

    expect(
      buildPaymentHistory({ tenant, payments: [], fromMonth: "bad", toMonth: "2026-06" })
    ).toEqual([]);
    expect(
      buildPaymentHistory({ tenant, payments: [], fromMonth: "2026-06", toMonth: "bad" })
    ).toEqual([]);
  });

  it("handles a range spanning a year boundary in correct chronological order", () => {
    const tenant = makeTenant();
    const history = buildPaymentHistory({
      tenant,
      payments: [],
      fromMonth: "2025-11",
      toMonth: "2026-02",
    });

    expect(history.map((h) => h.month)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("threads a custom onTimeDayLimit through to every month", () => {
    const tenant = makeTenant();
    const payments = [makePayment({ month: "2026-07", paid_on: "2026-07-10" })];

    const history = buildPaymentHistory({
      tenant,
      payments,
      fromMonth: "2026-06",
      toMonth: "2026-06",
      onTimeDayLimit: 10,
    });

    expect(history[0].status).toBe("paid");
  });
});
