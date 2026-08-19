import { describe, expect, it } from "vitest";
import { calculateRent, getIncreaseDisplay, getPaymentMonth, getRentMonth } from "./rent";
import { makeTenant } from "@/test/fixtures/tenants";
import { runHangRepro } from "@/test/hang-repro/run-hang-repro";
import type { Tenant } from "@/types/tenant";

describe("getRentMonth", () => {
  it("returns the prior calendar month", () => {
    expect(getRentMonth("2026-07")).toBe("2026-06");
  });

  it("rolls back across a year boundary", () => {
    expect(getRentMonth("2026-01")).toBe("2025-12");
  });

  it.each(["abc", "2026-13", "2026-00", "", "2026"])(
    "passes malformed input %j through unchanged",
    (input) => {
      expect(getRentMonth(input)).toBe(input);
    }
  );
});

describe("getPaymentMonth", () => {
  it("is the inverse of getRentMonth: rent for June is due in July", () => {
    expect(getPaymentMonth("2026-06")).toBe("2026-07");
  });

  it("rolls forward across a year boundary", () => {
    expect(getPaymentMonth("2026-12")).toBe("2027-01");
  });

  it.each(["abc", "2026-13", "2026-00", "", "2026"])(
    "passes malformed input %j through unchanged",
    (input) => {
      expect(getPaymentMonth(input)).toBe(input);
    }
  );

  it("round-trips with getRentMonth for valid months", () => {
    for (const month of ["2025-01", "2025-12", "2026-07"]) {
      expect(getPaymentMonth(getRentMonth(month))).toBe(month);
      expect(getRentMonth(getPaymentMonth(month))).toBe(month);
    }
  });
});

describe("calculateRent", () => {
  it("returns the base rent unmodified when no increase is configured", () => {
    const tenant = makeTenant({ base_rent: 10000, increase_month: undefined, increase_by: undefined });
    expect(calculateRent(tenant, "2026-07")).toBe(10000);
  });

  it("coerces a numeric-string base_rent", () => {
    const tenant = makeTenant({ base_rent: "10000", increase_month: undefined, increase_by: undefined });
    expect(calculateRent(tenant, "2026-07")).toBe(10000);
  });

  it("returns 0 when base_rent is non-numeric", () => {
    const tenant = makeTenant({ base_rent: "not-a-number" });
    expect(calculateRent(tenant, "2026-07")).toBe(0);
  });

  it("ignores an increase_month that doesn't match any month name", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2025-01-01",
      increase_month: "Notamonth",
      increase_by: 1.1,
      increase_type: "multiplier",
    });
    expect(calculateRent(tenant, "2026-07")).toBe(10000);
  });

  it("matches increase_month case- and whitespace-insensitively", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2025-01-01",
      increase_month: "  june  ",
      increase_by: 1.1,
      increase_type: "multiplier",
    });
    // Crossing June once (2025-01 -> 2025-07) should apply the increase.
    expect(calculateRent(tenant, "2025-07")).toBe(11000);
  });

  it("returns the base rent unmodified when increase_by doesn't coerce to a number", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2025-01-01",
      increase_month: "June",
      increase_by: "not-a-number",
      increase_type: "flat",
    });
    expect(calculateRent(tenant, "2025-07")).toBe(10000);
  });

  it.each(["", null, undefined])(
    "treats increase_by %j as unset (no increase applied)",
    (increaseBy) => {
      const tenant = makeTenant({
        base_rent: 10000,
        base_rent_as_of: "2025-01-01",
        increase_month: "June",
        increase_by: increaseBy as unknown as Tenant["increase_by"],
        increase_type: "flat",
      });
      expect(calculateRent(tenant, "2025-07")).toBe(10000);
    }
  );

  it("treats increase_by: 0 the same as unset, since it's falsy (documents current behavior)", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2025-01-01",
      increase_month: "June",
      increase_by: 0,
      increase_type: "flat",
    });
    expect(calculateRent(tenant, "2025-07")).toBe(10000);
  });

  it("applies a multiplier increase once when crossing the increase month forward", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2025-01-01",
      increase_month: "June",
      increase_by: 1.1,
      increase_type: "multiplier",
    });
    expect(calculateRent(tenant, "2025-07")).toBe(11000);
  });

  it("applies a flat increase once when crossing the increase month forward", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2025-01-01",
      increase_month: "June",
      increase_by: 500,
      increase_type: "flat",
    });
    expect(calculateRent(tenant, "2025-07")).toBe(10500);
  });

  it("compounds the increase every time the increase month is crossed across multiple years", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2024-01-01",
      increase_month: "June",
      increase_by: 1.1,
      increase_type: "multiplier",
    });
    // Crosses June in both 2024 and 2025 by the time we reach 2025-07.
    expect(calculateRent(tenant, "2025-07")).toBe(Math.round(10000 * 1.1 * 1.1));
  });

  it("undoes a multiplier increase when walking backward past the increase month", () => {
    const tenant = makeTenant({
      base_rent: 11000,
      base_rent_as_of: "2025-07-01",
      increase_month: "June",
      increase_by: 1.1,
      increase_type: "multiplier",
    });
    expect(calculateRent(tenant, "2025-01")).toBe(10000);
  });

  it("undoes a flat increase when walking backward past the increase month", () => {
    const tenant = makeTenant({
      base_rent: 10500,
      base_rent_as_of: "2025-07-01",
      increase_month: "June",
      increase_by: 500,
      increase_type: "flat",
    });
    expect(calculateRent(tenant, "2025-01")).toBe(10000);
  });

  it("applies no increase when targetMonth is the same month as base_rent_as_of", () => {
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2025-03-01",
      increase_month: "June",
      increase_by: 1.1,
      increase_type: "multiplier",
    });
    expect(calculateRent(tenant, "2025-03")).toBe(10000);
  });

  describe("increase_effective_from (delayed first increment)", () => {
    // Mirrors a real agreement: base rent 10000 from 2026-08-01, 5%
    // multiplier every August, but the first increment is skipped — it
    // doesn't take effect until 2027-08 (so 2027-08 is still flat, and the
    // first actual raise lands in 2028-08).
    const tenant = makeTenant({
      base_rent: 10000,
      base_rent_as_of: "2026-08-01",
      increase_month: "August",
      increase_by: 1.05,
      increase_type: "multiplier",
      increase_effective_from: "2027-08-01",
    });

    it("stays flat for the skipped first year", () => {
      expect(calculateRent(tenant, "2026-08")).toBe(10000);
      expect(calculateRent(tenant, "2027-01")).toBe(10000);
      expect(calculateRent(tenant, "2027-07")).toBe(10000);
    });

    it("stays flat through the year the schedule becomes effective, since that's the walk origin", () => {
      expect(calculateRent(tenant, "2027-08")).toBe(10000);
      expect(calculateRent(tenant, "2028-07")).toBe(10000);
    });

    it("applies the first real increment the following year", () => {
      expect(calculateRent(tenant, "2028-08")).toBe(10500);
    });

    it("compounds normally in subsequent years", () => {
      expect(calculateRent(tenant, "2029-08")).toBe(Math.round(10000 * 1.05 * 1.05));
      expect(calculateRent(tenant, "2030-08")).toBe(
        Math.round(10000 * 1.05 * 1.05 * 1.05)
      );
    });

    it("is ignored when unparseable, falling back to normal base_rent_as_of behavior", () => {
      const withGarbage = makeTenant({
        base_rent: 10000,
        base_rent_as_of: "2026-08-01",
        increase_month: "August",
        increase_by: 1.05,
        increase_type: "multiplier",
        increase_effective_from: "not-a-date",
      });
      // Falls through to the normal schedule anchored on base_rent_as_of,
      // i.e. the increase applies on the very next crossing.
      expect(calculateRent(withGarbage, "2027-08")).toBe(10500);
    });

    it("has no effect when unset — existing tenants are unaffected", () => {
      const withoutField = makeTenant({
        base_rent: 10000,
        base_rent_as_of: "2026-08-01",
        increase_month: "August",
        increase_by: 1.05,
        increase_type: "multiplier",
      });
      expect(calculateRent(withoutField, "2027-08")).toBe(10500);
    });
  });
});

describe("getIncreaseDisplay", () => {
  it("formats a multiplier as a percentage", () => {
    expect(getIncreaseDisplay("multiplier", 1.1)).toBe("10%");
  });

  it("formats a flat increase as an Indian-formatted currency amount", () => {
    expect(getIncreaseDisplay("flat", 500)).toBe("₹500");
  });

  it("returns an em dash when type is missing", () => {
    expect(getIncreaseDisplay("", 500)).toBe("—");
  });

  it("returns an em dash when value is missing or 0", () => {
    expect(getIncreaseDisplay("flat", 0)).toBe("—");
  });

  it("falls back to the raw value as a string for an unrecognized type", () => {
    expect(getIncreaseDisplay("unknown", "500")).toBe("500");
  });
});

describe("calculateRent — invalid dates don't hang", () => {
  // An unparseable base_rent_as_of or malformed targetMonth used to produce
  // an Invalid Date; every comparison against an Invalid Date is false, so
  // the month-walking while-loop never terminated. This is a genuine
  // synchronous infinite loop (confirmed by direct reproduction), not
  // something Vitest's own per-test timeout can interrupt — that mechanism
  // only fires once the event loop is free to run it, which never happens
  // inside a blocking `while` loop. Each scenario is run in an isolated
  // child process with a hard OS-level timeout instead; see test/hang-repro/.
  it(
    "does not hang when base_rent_as_of is unparseable",
    () => {
      const { timedOut } = runHangRepro(
        "test/hang-repro/invalid-base-rent-as-of.spec.ts"
      );
      expect(timedOut).toBe(false);
    },
    8000
  );

  it(
    "does not hang when targetMonth is malformed",
    () => {
      const { timedOut } = runHangRepro("test/hang-repro/invalid-target-month.spec.ts");
      expect(timedOut).toBe(false);
    },
    8000
  );
});
