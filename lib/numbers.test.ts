import { describe, expect, it } from "vitest";
import { median, percentOf, round, sum } from "./numbers";

describe("round", () => {
  it("rounds to the given number of places", () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(1.235, 1)).toBe(1.2);
  });
});

describe("sum", () => {
  it("adds, and is zero for nothing", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});

describe("median", () => {
  it("takes the middle value, or the mean of the middle two", () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("percentOf", () => {
  it("is a whole-number percentage", () => {
    expect(percentOf(1, 4)).toBe(25);
  });

  it("is null when there is nothing to take a share of", () => {
    expect(percentOf(0, 0)).toBeNull();
  });

  it("only says 100 when it is all of it, and 0 when it is none", () => {
    expect(percentOf(999, 1000)).toBe(99);
    expect(percentOf(1, 1000)).toBe(1);
    expect(percentOf(1000, 1000)).toBe(100);
    expect(percentOf(0, 1000)).toBe(0);
  });
});
