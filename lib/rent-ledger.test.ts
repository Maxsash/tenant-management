import { describe, expect, it } from "vitest";
import { makeTenant } from "@/test/fixtures/tenants";
import { makePayment } from "@/test/fixtures/payments";
import { buildRentLedger } from "./rent-ledger";

describe("buildRentLedger", () => {
  it("has one entry per tenant per month owed, chronological then in tenant order", () => {
    const a = makeTenant({ id: "a" });
    const b = makeTenant({ id: "b" });

    const ledger = buildRentLedger([a, b], [], { from: "2026-05", to: "2026-06" });

    expect(ledger.map((e) => `${e.rent_month}:${e.tenant.id}`)).toEqual([
      "2026-05:a",
      "2026-05:b",
      "2026-06:a",
      "2026-06:b",
    ]);
  });

  it("takes the amount from the rent schedule, including a scheduled increase", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2026-01-01",
      increase_month: "June",
      increase_by: 500,
      increase_type: "flat",
    });

    const ledger = buildRentLedger([tenant], [], { from: "2026-05", to: "2026-06" });

    expect(ledger.map((e) => e.amount)).toEqual([10000, 10500]);
  });

  it("reads status and the on-time deadline for the rent month, not the payment month", () => {
    const tenant = makeTenant();
    const payments = [
      makePayment({ month: "2026-06", paid_on: "2026-06-03" }), // May rent, on time
      makePayment({ month: "2026-07", paid_on: "2026-07-12" }), // June rent, late
    ];

    const ledger = buildRentLedger([tenant], payments, { from: "2026-05", to: "2026-07" });

    expect(ledger.map((e) => [e.rent_month, e.status, e.paid_on, e.due_by])).toEqual([
      ["2026-05", "paid", "2026-06-03", "2026-06-07"],
      ["2026-06", "late", "2026-07-12", "2026-07-07"],
      ["2026-07", "pending", null, "2026-08-07"],
    ]);
  });

  it("leaves out months before a tenant moved in and after they moved out", () => {
    const tenant = makeTenant({
      tenant_since: "2026-03-01",
      active: false,
      vacated_on: "2026-05-31",
    });

    const ledger = buildRentLedger([tenant], [], { from: "2026-01", to: "2026-08" });

    expect(ledger.map((e) => e.rent_month)).toEqual(["2026-03", "2026-04", "2026-05"]);
  });

  it("never matches one tenant's payment to another", () => {
    const a = makeTenant({ id: "a" });
    const b = makeTenant({ id: "b" });
    const payments = [makePayment({ tenant_id: "a", month: "2026-07", paid_on: "2026-07-02" })];

    const ledger = buildRentLedger([a, b], payments, { from: "2026-06", to: "2026-06" });

    expect(ledger.map((e) => [e.tenant.id, e.status])).toEqual([
      ["a", "paid"],
      ["b", "pending"],
    ]);
  });

  it("is empty for a malformed or inverted range", () => {
    const tenant = makeTenant();

    expect(buildRentLedger([tenant], [], { from: "", to: "" })).toEqual([]);
    expect(buildRentLedger([tenant], [], { from: "2026-07", to: "2026-06" })).toEqual([]);
  });
});
