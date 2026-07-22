import { describe, expect, it } from "vitest";
import { deriveExpenseFields } from "./expenses";
import { makeExpenseItem } from "@/test/fixtures/expenses";

describe("deriveExpenseFields", () => {
  describe("mode: pick", () => {
    it("derives item_name/category from the matched catalog item", () => {
      const items = [makeExpenseItem({ id: "item-1", name: "Milk", category: "Groceries" })];

      const result = deriveExpenseFields({
        mode: "pick",
        item_id: "item-1",
        quantity: 2,
        unit: "L",
        items,
      });

      expect(result).toEqual({
        item_id: "item-1",
        item_name: "Milk",
        category: "Groceries",
        is_itemized: true,
        quantity: 2,
        unit: "L",
      });
    });

    it("errors when item_id doesn't match any catalog item", () => {
      const result = deriveExpenseFields({ mode: "pick", item_id: "missing", items: [] });
      expect(result).toEqual({ error: "Pick an item, or switch to Other / Lump Sum" });
    });

    it("defaults quantity/unit to null when omitted", () => {
      const items = [makeExpenseItem({ id: "item-1" })];
      const result = deriveExpenseFields({ mode: "pick", item_id: "item-1", items });

      expect(result).toMatchObject({ quantity: null, unit: null });
    });
  });

  describe("mode: custom", () => {
    it("derives item_name from the trimmed custom name", () => {
      const result = deriveExpenseFields({
        mode: "custom",
        custom_name: "  Birthday cake  ",
        category: "Groceries",
        items: [],
      });

      expect(result).toEqual({
        item_id: null,
        item_name: "Birthday cake",
        category: "Groceries",
        is_itemized: true,
        quantity: null,
        unit: null,
      });
    });

    it("errors when custom_name is empty or whitespace-only", () => {
      expect(
        deriveExpenseFields({ mode: "custom", custom_name: "   ", category: "Groceries", items: [] })
      ).toEqual({ error: "Enter an item name" });
      expect(
        deriveExpenseFields({ mode: "custom", category: "Groceries", items: [] })
      ).toEqual({ error: "Enter an item name" });
    });

    it("errors when no category is chosen", () => {
      const result = deriveExpenseFields({ mode: "custom", custom_name: "Cake", items: [] });
      expect(result).toEqual({ error: "Pick a category" });
    });
  });

  describe("mode: lump", () => {
    it("synthesizes the '(mixed)' item_name and marks is_itemized: false", () => {
      const result = deriveExpenseFields({ mode: "lump", category: "Groceries", items: [] });

      expect(result).toEqual({
        item_id: null,
        item_name: "Groceries (mixed)",
        category: "Groceries",
        is_itemized: false,
        quantity: null,
        unit: null,
      });
    });

    it("forces quantity/unit to null even if provided", () => {
      const result = deriveExpenseFields({
        mode: "lump",
        category: "Groceries",
        quantity: 5,
        unit: "kg",
        items: [],
      });

      expect(result).toMatchObject({ quantity: null, unit: null });
    });

    it("errors when no category is chosen", () => {
      const result = deriveExpenseFields({ mode: "lump", items: [] });
      expect(result).toEqual({ error: "Pick a category" });
    });
  });
});
