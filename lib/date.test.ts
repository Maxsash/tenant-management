import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentDate, currentMonth, isValidDate, isValidMonth } from "./date";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("currentMonth", () => {
  it("returns the UTC year-month of the system clock", () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(currentMonth()).toBe("2026-07");
  });
});

describe("currentDate", () => {
  it("returns the UTC calendar date of the system clock", () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(currentDate()).toBe("2026-07-15");
  });
});

describe("isValidMonth", () => {
  it.each(["2026-01", "2026-12"])("accepts %j", (value) => {
    expect(isValidMonth(value)).toBe(true);
  });

  it.each([undefined, null, 202607, "", "2026", "2026-7", "2026-00", "2026-13", "2026-07-01"])(
    "rejects %j",
    (value) => {
      expect(isValidMonth(value)).toBe(false);
    }
  );
});

describe("isValidDate", () => {
  it.each(["2026-01-01", "2026-12-31", "2028-02-29"])("accepts %j", (value) => {
    expect(isValidDate(value)).toBe(true);
  });

  it.each([
    undefined,
    null,
    20260701,
    "",
    "2026-07",
    "2026-7-01",
    "01-07-2026",
    "2026-07-01T00:00:00Z",
    "2026-13-01",
    "2026-02-30",
    "2027-02-29",
    "2026-06-31",
    "2026-07-00",
  ])("rejects %j", (value) => {
    expect(isValidDate(value)).toBe(false);
  });
});
