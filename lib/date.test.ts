import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMonths,
  addCalendarMonths,
  addDays,
  currentDate,
  currentMonth,
  daysBetween,
  isValidDate,
  isValidMonth,
  monthRange,
} from "./date";

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

describe("addMonths", () => {
  it("moves forward across a year boundary", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });

  it("moves backward across a year boundary", () => {
    expect(addMonths("2026-02", -3)).toBe("2025-11");
  });

  it("passes malformed input through untouched", () => {
    expect(addMonths("", 1)).toBe("");
    expect(addMonths("2026", 1)).toBe("2026");
  });
});

describe("monthRange", () => {
  it("is inclusive at both ends", () => {
    expect(monthRange("2026-07", "2026-10")).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("returns nothing when the range is inverted or malformed", () => {
    expect(monthRange("2026-10", "2026-07")).toEqual([]);
    expect(monthRange("nope", "2026-07")).toEqual([]);
  });
});

describe("daysBetween", () => {
  it("counts whole days, across a month boundary", () => {
    expect(daysBetween("2026-08-28", "2026-09-07")).toBe(10);
  });

  it("is zero for the same day and negative when the second date is earlier", () => {
    expect(daysBetween("2026-09-07", "2026-09-07")).toBe(0);
    expect(daysBetween("2026-09-07", "2026-09-01")).toBe(-6);
  });

  it("counts a leap day", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });
});

describe("addDays", () => {
  it("crosses month and year ends, both ways", () => {
    expect(addDays("2026-09-02", 30)).toBe("2026-10-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("agrees with daysBetween", () => {
    expect(daysBetween("2028-02-20", addDays("2028-02-20", 26))).toBe(26);
  });
});

describe("addCalendarMonths", () => {
  it("keeps the day of the month", () => {
    expect(addCalendarMonths("2026-09-02", 1)).toBe("2026-10-02");
    expect(addCalendarMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("holds to the end of a shorter month", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addCalendarMonths("2026-08-31", 1)).toBe("2026-09-30");
  });
});
