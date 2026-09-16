import { z } from "zod";

/**
 * The contract every slip reader answers in, whichever provider is behind it.
 * Kept apart from the readers themselves so the shape is defined once and the
 * matching layer downstream never has to care where the lines came from.
 */

export const SlipLineSchema = z.object({
  raw_text: z
    .string()
    .describe("The line exactly as written on the slip, in its own script."),
  line_date: z
    .string()
    .nullable()
    .describe(
      "This line's own date as YYYY-MM-DD, read day-first. A slip is often a running page covering several days: carry the last date written down to the lines under it, including lines marked with ditto marks, and on from one photo to the next. Null only if no date has appeared yet."
    ),
  item_name: z
    .string()
    .describe("Catalogue name if one fits, else the slip's word transliterated."),
  category: z
    .string()
    .nullable()
    .describe("Only a category from the list given. Null if a catalogue item was named."),
  quantity: z
    .number()
    .nullable()
    .describe("The number written on the slip, unconverted. Null if none."),
  unit: z
    .string()
    .nullable()
    .describe("The unit as written: kg, g, L, ml, pcs, packet, dozen. Null if none."),
  amount: z.number().describe("Rupees for this line. 0 if illegible."),
});

export const SlipExtractionSchema = z.object({
  slip_date: z
    .string()
    .nullable()
    .describe(
      "The single date covering the whole slip, as YYYY-MM-DD. Null when the slip is undated, and null when it is a running page covering several days, or when several photos between them do — in that case put each line's date on the line itself."
    ),
  stated_total: z
    .number()
    .nullable()
    .describe(
      "The total the slip writes down, across every photo. Null if it writes none."
    ),
  lines: z.array(SlipLineSchema),
  unreadable: z
    .string()
    .nullable()
    .describe("What could not be read, in plain English. Null if all clear."),
});

/**
 * The same schema as plain JSON Schema, for providers that take one directly
 * rather than through an SDK helper.
 *
 * `$schema` is stripped: it is dialect metadata rather than a constraint, and
 * schema validators on the provider side are apt to reject keys they do not
 * recognise. Nothing downstream reads it.
 */
export function slipJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(SlipExtractionSchema) as Record<string, unknown>;

  delete schema.$schema;

  return schema;
}

/**
 * The one request every reader is given alongside the photos, so switching
 * provider changes only the transport. It names the photo count because
 * "these are one slip" is exactly what a model would otherwise have to guess.
 */
export function buildSlipUserPrompt(photoCount: number): string {
  if (photoCount <= 1) {
    return "Read this slip. Report every line item on it, its stated total if it has one, and its date.";
  }

  return `These ${photoCount} photos are one slip, in the order they were taken. Read them together as one continuous page: report every line item across all of them exactly once, the slip's stated total if it has one, and each line's date.`;
}
