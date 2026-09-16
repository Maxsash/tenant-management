import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { buildSlipUserPrompt, SlipExtractionSchema, slipJsonSchema } from "./schema";

/**
 * Neither provider's live call can be exercised without a key, so these cover
 * what breaks before the network: the request shape each one is handed, and
 * the parse that stands between a model's answer and the database.
 */
describe("slipJsonSchema", () => {
  it("produces a JSON Schema object for providers that take one directly", () => {
    const schema = slipJsonSchema() as {
      type?: string;
      required?: string[];
      properties?: Record<string, unknown>;
    };

    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(
      expect.arrayContaining(["slip_date", "stated_total", "lines", "unreadable"])
    );
    expect(schema.properties?.lines).toBeDefined();
  });

  it("carries the field descriptions the model is steered by", () => {
    // The descriptions are the only place the per-field instructions live —
    // losing them in a schema refactor would quietly degrade the read.
    expect(JSON.stringify(slipJsonSchema())).toContain("day-first");
  });
});

describe("SlipExtractionSchema", () => {
  it("converts to a structured-output format the Anthropic SDK accepts", () => {
    const format = zodOutputFormat(SlipExtractionSchema);

    expect(format.type).toBe("json_schema");
    expect(format.schema).toBeDefined();
  });

  it("accepts a well-formed slip", () => {
    const parsed = SlipExtractionSchema.safeParse({
      slip_date: "2026-07-07",
      stated_total: 70,
      lines: [
        {
          raw_text: "आलू 3 kg 40",
          line_date: "2026-07-07",
          item_name: "Aaloo",
          category: null,
          quantity: 3,
          unit: "kg",
          amount: 40,
        },
      ],
      unreadable: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a line with no amount rather than defaulting it to zero", () => {
    const parsed = SlipExtractionSchema.safeParse({
      slip_date: null,
      stated_total: null,
      lines: [{ raw_text: "x", line_date: null, item_name: "x", category: null, quantity: null, unit: null }],
      unreadable: null,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects an answer that is not a slip at all", () => {
    expect(SlipExtractionSchema.safeParse({ hello: "world" }).success).toBe(false);
    expect(SlipExtractionSchema.safeParse("a sentence").success).toBe(false);
  });
});

describe("buildSlipUserPrompt", () => {
  it("asks for one slip from one photo", () => {
    expect(buildSlipUserPrompt(1)).toContain("Read this slip");
  });

  it("says several photos are one slip, in order, with each line reported once", () => {
    const prompt = buildSlipUserPrompt(2);

    expect(prompt).toContain("These 2 photos are one slip");
    expect(prompt).toContain("in the order they were taken");
    expect(prompt).toContain("exactly once");
  });
});

describe("slipJsonSchema dialect metadata", () => {
  it("omits $schema, which provider-side validators may reject", () => {
    expect(slipJsonSchema()).not.toHaveProperty("$schema");
  });
});
