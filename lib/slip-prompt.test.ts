import { describe, expect, it } from "vitest";
import { buildSlipSystemPrompt, formatCatalogue } from "@/lib/slip-prompt";
import { makeExpenseCategory, makeExpenseItem } from "@/test/fixtures/expenses";

const categories = [
  makeExpenseCategory({ id: "cat-veg", name: "Vegetables & Fruits", icon: "🥬" }),
  makeExpenseCategory({ id: "cat-groc", name: "Groceries", icon: "🛒", sort_order: 1 }),
];

const items = [
  makeExpenseItem({
    id: "aaloo",
    name: "Aaloo",
    category: "Vegetables & Fruits",
    default_unit: "kg",
  }),
  makeExpenseItem({
    id: "prasad",
    name: "Prasad",
    category: "Groceries",
    default_unit: null,
  }),
];

describe("formatCatalogue", () => {
  it("lists every item under its category, with the unit when there is one", () => {
    const catalogue = formatCatalogue(categories, items);

    expect(catalogue).toContain("- Aaloo | kg");
    expect(catalogue).toContain("- Prasad");
    expect(catalogue).not.toContain("- Prasad |");
  });

  it("names the categories the model is allowed to choose from", () => {
    expect(formatCatalogue(categories, items)).toContain(
      "Vegetables & Fruits, Groceries"
    );
  });

  it("omits a category with no items rather than printing an empty heading", () => {
    const withEmpty = [
      ...categories,
      makeExpenseCategory({ id: "cat-empty", name: "Documents", sort_order: 5 }),
    ];

    const [names, body] = formatCatalogue(withEmpty, items).split(
      "Catalogue of known items, by category"
    );

    // Still offered as a category to choose, but given no empty item block.
    expect(names).toContain("Documents");
    expect(body).not.toContain("Documents");
  });
});

describe("buildSlipSystemPrompt", () => {
  const prompt = buildSlipSystemPrompt(categories, items, "2026-09-09");

  it("states the day-first date convention explicitly", () => {
    // Reading 3.7.26 as 7 March files the whole slip in the wrong month.
    expect(prompt).toContain("3.7.26");
    expect(prompt).toContain("3 July 2026");
    expect(prompt).toContain("NOT 7 March");
  });

  it("passes today through so a two-digit year can be resolved", () => {
    expect(prompt).toContain("2026-09-09");
  });

  it("carries the catalogue so answers come back in the app's own spellings", () => {
    expect(prompt).toContain("- Aaloo | kg");
  });

  it("tells the model to report rather than invent an unreadable line", () => {
    expect(prompt).toContain("Never invent a line");
  });

  it("is a pure function of its arguments", () => {
    expect(buildSlipSystemPrompt(categories, items, "2026-09-09")).toBe(prompt);
  });
});

describe("naming rules", () => {
  const prompt = buildSlipSystemPrompt(categories, items, "2026-09-09");

  it("does not attach units with brackets a name could plausibly contain", () => {
    // "- Paav (packet)" got copied into the answer verbatim on a real slip.
    expect(formatCatalogue(categories, items)).not.toContain("(kg)");
  });

  it("forbids folding a unit into the item name", () => {
    // Observed on a real slip: "Paav (packet)" came back and failed to match
    // the catalogue's "Paav", which would have started a duplicate item.
    expect(prompt).toContain("Paav (packet)");
    expect(prompt).toContain("in their own fields");
  });

  it("still allows a parenthesised brand, which is part of a real name", () => {
    expect(prompt).toContain("Chai patti (Red Label)");
  });

  it("explains that a running page carries its date down", () => {
    expect(prompt).toContain("ditto marks");
    expect(prompt).toContain("line_date");
  });
});
