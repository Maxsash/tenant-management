import { describe, expect, it } from "vitest";
import { calculateRent } from "@/lib/rent";

// Run in isolation via vitest.hang-repro.config.ts (see lib/rent.test.ts) —
// this scenario currently hangs the process forever, so it must never be
// collected by the main test suite.
describe("calculateRent with a malformed targetMonth", () => {
  it("returns the base rent unmodified rather than hanging", () => {
    const tenant = {
      base_rent: 10000,
      base_rent_as_of: "2025-01-01",
      increase_month: "June",
      increase_by: 1.1,
      increase_type: "multiplier",
    };

    expect(calculateRent(tenant, "garbage")).toBe(10000);
  });
});
