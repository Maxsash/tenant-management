import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORY_ICON,
  PAYMENT_METHODS,
  getCategoryIcon,
  groupItemsByCategory,
} from "./expense-categories";
import { makeExpenseCategory, makeExpenseItem } from "@/test/fixtures/expenses";

describe("PAYMENT_METHODS", () => {
  it("contains exactly these 4 values in this order", () => {
    expect(PAYMENT_METHODS).toEqual(["Cash", "UPI", "Card", "Bank Transfer"]);
  });
});

describe("getCategoryIcon", () => {
  it("returns the icon of a matching category", () => {
    const categories = [makeExpenseCategory({ name: "Groceries", icon: "🛒" })];
    expect(getCategoryIcon(categories, "Groceries")).toBe("🛒");
  });

  it("returns the default icon when no category matches", () => {
    const categories = [makeExpenseCategory({ name: "Groceries", icon: "🛒" })];
    expect(getCategoryIcon(categories, "Utilities")).toBe(DEFAULT_CATEGORY_ICON);
  });

  it("returns the default icon for an empty category list", () => {
    expect(getCategoryIcon([], "Groceries")).toBe(DEFAULT_CATEGORY_ICON);
  });
});

describe("groupItemsByCategory", () => {
  it("groups items under their category, preserving category order", () => {
    const categories = [
      makeExpenseCategory({ name: "Groceries", icon: "🛒" }),
      makeExpenseCategory({ name: "Utilities", icon: "💡" }),
    ];
    const items = [
      makeExpenseItem({ name: "Electricity", category: "Utilities" }),
      makeExpenseItem({ name: "Milk", category: "Groceries" }),
    ];

    const grouped = groupItemsByCategory(categories, items);

    expect(grouped.map((g) => g.category)).toEqual(["Groceries", "Utilities"]);
    expect(grouped[0].items.map((i) => i.name)).toEqual(["Milk"]);
    expect(grouped[0].icon).toBe("🛒");
  });

  it("drops categories with no items", () => {
    const categories = [
      makeExpenseCategory({ name: "Groceries" }),
      makeExpenseCategory({ name: "Empty Category" }),
    ];
    const items = [makeExpenseItem({ name: "Milk", category: "Groceries" })];

    const grouped = groupItemsByCategory(categories, items);

    expect(grouped.map((g) => g.category)).toEqual(["Groceries"]);
  });

  it("returns [] when there are no categories or no matching items", () => {
    expect(groupItemsByCategory([], [])).toEqual([]);
    expect(
      groupItemsByCategory([makeExpenseCategory({ name: "Groceries" })], [])
    ).toEqual([]);
  });
});
