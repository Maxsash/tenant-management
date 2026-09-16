import { describe, expect, it } from "vitest";
import { findRentPayment, getPaidOnError, PAID_ON_FUTURE_GRACE_DAYS } from "./payments";
import { makePayment } from "@/test/fixtures/payments";

const TODAY = "2026-09-16";

describe("getPaidOnError", () => {
  it.each(["2026-09-16", "2026-09-01", "2026-08-03", "2024-01-15"])(
    "accepts today or any earlier date (%j)",
    (paidOn) => {
      expect(getPaidOnError(paidOn, TODAY)).toBeNull();
    }
  );

  it("accepts tomorrow, since India's today is often UTC's tomorrow", () => {
    expect(PAID_ON_FUTURE_GRACE_DAYS).toBe(1);
    expect(getPaidOnError("2026-09-17", TODAY)).toBeNull();
  });

  it("refuses a date past the grace day", () => {
    expect(getPaidOnError("2026-09-18", TODAY)).toBe("Payment date can't be in the future");
    expect(getPaidOnError("2027-09-16", TODAY)).toBe("Payment date can't be in the future");
  });

  it("applies the grace day across a month and year boundary", () => {
    expect(getPaidOnError("2027-01-01", "2026-12-31")).toBeNull();
    expect(getPaidOnError("2027-01-02", "2026-12-31")).toBe("Payment date can't be in the future");
  });

  it.each([undefined, null, "", 20260910, "2026-09", "10-09-2026", "2026-02-30", "yesterday"])(
    "refuses a malformed date (%j)",
    (paidOn) => {
      expect(getPaidOnError(paidOn, TODAY)).toBe("Invalid payment date. Expected YYYY-MM-DD");
    }
  );
});

describe("findRentPayment", () => {
  const payments = [
    { ...makePayment({ id: 1, tenant_id: "t1", month: "2026-08" }), rent_month: "2026-07" },
    { ...makePayment({ id: 2, tenant_id: "t1", month: "2026-09" }), rent_month: "2026-08" },
    { ...makePayment({ id: 3, tenant_id: "t2", month: "2026-09" }), rent_month: "2026-08" },
  ];

  it("finds the payment for that tenant's rent month", () => {
    expect(findRentPayment(payments, "t1", "2026-08")?.id).toBe(2);
    expect(findRentPayment(payments, "t2", "2026-08")?.id).toBe(3);
  });

  it("matches the rent month, not the raw payment-month column", () => {
    // Row 1's `month` is 2026-08, but it pays July's rent.
    expect(findRentPayment(payments, "t1", "2026-07")?.id).toBe(1);
  });

  it("returns undefined when nothing is recorded", () => {
    expect(findRentPayment(payments, "t1", "2026-09")).toBeUndefined();
    expect(findRentPayment(payments, "t3", "2026-08")).toBeUndefined();
    expect(findRentPayment([], "t1", "2026-08")).toBeUndefined();
  });
});
