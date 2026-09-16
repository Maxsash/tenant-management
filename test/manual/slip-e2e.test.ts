import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { geminiReader } from "@/lib/slip-reader/gemini";
import { buildSlipDraft } from "@/lib/slip-matching";
import { makeExpenseCategory, makeExpenseItem } from "@/test/fixtures/expenses";

// One path, or several comma-separated for the sides of one page, in order.
const SLIPS = process.env.SLIP_PATH!.split(",");

describe("real slip", () => {
  it("reads", async () => {
    const categories = [
      "Vegetables & Fruits", "Groceries", "Dairy", "Household", "Religious",
      "Eating Out", "Medical", "Personal Care", "Transport", "Other",
    ].map((name, i) => makeExpenseCategory({ id: `c${i}`, name, sort_order: i }));

    const items = [
      ["Sabzi", "Vegetables & Fruits", null], ["Aaloo", "Vegetables & Fruits", "kg"],
      ["Paav", "Groceries", "packet"], ["Gas cylinder", "Household", null],
      ["Pooja ka saaman", "Religious", null], ["Dona", "Religious", null],
      ["Chawal pisai", "Other", null], ["Washing machine stand", "Household", null],
      ["Parcel", "Eating Out", null], ["Khana", "Eating Out", null],
    ].map(([name, category, unit], i) =>
      makeExpenseItem({ id: `i${i}`, name: name as string, category: category as string, default_unit: unit as string | null })
    );

    const started = Date.now();
    const extraction = await geminiReader.read({
      images: SLIPS.map((path) => ({
        base64: fs.readFileSync(path).toString("base64"),
        mediaType: "image/jpeg",
      })),
      categories, items, today: "2026-09-09",
    });
    // Worth watching: past about a minute the phone gives up ("Load failed").
    console.log(`read in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    const draft = buildSlipDraft(extraction, { items, categories, today: "2026-09-09" });

    fs.writeFileSync("/tmp/e2e.json", JSON.stringify({ extraction, draft }, null, 2));
    expect(extraction.lines.length).toBeGreaterThan(0);
  }, 120000);
});
