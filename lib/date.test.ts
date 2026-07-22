import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentDate, currentMonth } from "./date";

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
