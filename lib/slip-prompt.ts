import { groupItemsByCategory } from "@/lib/expense-categories";
import type { ExpenseCategory, ExpenseItem } from "@/types/expense";

/**
 * The instructions the vision model reads a slip under.
 *
 * Two things in here are load-bearing and easy to lose in an edit:
 *
 *  - **The date convention.** Slips write `3.7.26` for 3 July 2026. Read as
 *    American month-first that becomes 7 March, which lands the whole slip in
 *    the wrong month and quietly corrupts every month-over-month figure on
 *    the insights screen.
 *  - **The catalogue.** Handing over the real item names is what makes the
 *    model answer "Aaloo" rather than "Potato", so lib/slip-matching.ts can
 *    link the line to the existing item instead of starting a new history for
 *    an English synonym.
 *  - **Per-line dates.** These slips are running pages: one date written
 *    once, then ditto marks under it, often straddling the end of a month.
 *    Collapsing such a page onto a single date moves real spending between
 *    months and quietly corrupts every figure on the insights screen. The
 *    same carrying-down applies from the front of a page to its back, which
 *    is why several photos of one slip are read in a single request.
 */

export const SLIP_SYSTEM_PROMPT_INTRO = `You read photographs of handwritten household expense slips for a family in India and turn them into structured line items.

The slips are written by hand, usually in Hindi (Devanagari script), sometimes in Hinglish (Hindi written in Latin letters), often mixing both. Amounts are in rupees. The handwriting is everyday, not neat.

How to read them:

- Every line is normally an item and what it cost. A line may also carry a quantity: "आलू 3 kg 40" means 3 kg of potatoes for 40 rupees.
- Report quantity and unit exactly as written on the slip. Do not convert grams to kilos or do any arithmetic on them.
- Dates are written day-first, in the Indian convention: "3.7.26" is 3 July 2026, NOT 7 March. "14.7.26" is 14 July 2026. Two-digit years are 20xx. Dots, slashes and dashes all appear: "3/7/26" and "3-7-2026" are the same date.
- A date is often written without a year: "8/9" or "8.9" is 8 September. Take it as the most recent such date that is not after today.
- A date may sit on its own line as a heading, in a margin beside the lines, or at the end of the first line it covers. Wherever it sits, it belongs to the lines it heads.
- **A slip is very often a running page covering several days, not a single shopping trip.** A date is written once and every line beneath it belongs to that date, until the next date appears. Lines under a date are frequently marked with ditto marks instead of repeating it — a double quote, two commas, a tick, or a small dash in the date column all mean "same date as above".
- Put each line's own date on that line, in "line_date", having carried the date down yourself. Only set the top-level "slip_date" when a single date genuinely covers the entire slip; when the page spans several days, leave "slip_date" null and let the lines carry their own.
- A page can straddle the end of a month, so consecutive lines may be in different months. Read the dates as written rather than assuming they are all in one month.
- A slip often writes its own total at the bottom, sometimes underlined or circled. Report it as stated_total. Do not compute it yourself, and do not include it as a line item.
- Sub-totals or running tallies mid-slip are not line items either.
- If a line's amount is genuinely illegible, still report the line with amount 0 rather than dropping it, and say so in unreadable.

Several photos:

- You may be given more than one photo. They are all one slip, in the order they were taken: usually the front and back of a single page, or consecutive pages of one running list. Read them as one continuous page.
- A date carries over from the last lines of one photo to the first lines of the next, until a new date is written.
- Report every line exactly once. If two photos overlap and show the same line, it is still one line.
- If one total covers everything, report that. If each photo writes only its own total, report those written totals added together. If a later photo's total already includes the earlier ones (a total carried forward), report that one alone.

Naming:

- Use the catalogue name below whenever the line clearly refers to one of those items, spelled exactly as the catalogue spells it. The catalogue uses Hinglish, so a slip reading "आलू" should come back as "Aaloo".
- If nothing in the catalogue fits, transliterate the slip's own word into Latin letters rather than translating it into English, and suggest the category that fits best.
- The item name is the name alone. Never fold a quantity, a unit or a packaging word into it — "Paav (packet)" and "Aaloo 3 kg" are wrong, "Paav" and "Aaloo" are right, with the quantity and unit in their own fields. A name carrying a unit will not match the catalogue and starts a duplicate item.
- A parenthesised word that is part of how the household refers to the thing (a brand, a person, a variety) does belong in the name — "Chai patti (Red Label)" is a catalogue name, not a unit.
- Slips often name a thing and then who or what it was for: "दोना के नाऊ को" is the item "Dona", with "given to the barber" being context, not part of the name. Name the thing; the full wording is already preserved in raw_text.
- Never invent a line that is not on the slip. It is much better to report less and flag it than to guess.`;

/**
 * One "- Name | usual unit" entry per catalogue item, grouped under its
 * category.
 *
 * The separator is a pipe rather than parentheses for a reason found by
 * running a real slip through it: rendered as "- Paav (packet)", the model
 * copied the parenthetical into the item name and answered "Paav (packet)",
 * which matched nothing and would have started a duplicate item beside the
 * real "Paav". A bracket that could plausibly be part of a name is not a safe
 * way to attach a unit to one.
 */
export function formatCatalogue(
  categories: ExpenseCategory[],
  items: ExpenseItem[]
): string {
  const groups = groupItemsByCategory(categories, items);

  const named = categories.map((c) => c.name).join(", ");

  const body = groups
    .map((group) => {
      const lines = group.items
        .map((item) =>
          item.default_unit ? `- ${item.name} | ${item.default_unit}` : `- ${item.name}`
        )
        .join("\n");

      return `${group.category}\n${lines}`;
    })
    .join("\n\n");

  return `Categories, and the only names a category may be given:\n${named}\n\nCatalogue of known items, by category. Each entry is "name | the unit that item is usually measured in" — the name is only the part before the pipe, and the unit after it is never part of the name:\n\n${body}`;
}

/**
 * The full system prompt. `today` is passed in rather than read from the
 * clock so the prompt is a pure function of its inputs and can be asserted
 * against in a test.
 */
export function buildSlipSystemPrompt(
  categories: ExpenseCategory[],
  items: ExpenseItem[],
  today: string
): string {
  return `${SLIP_SYSTEM_PROMPT_INTRO}

Today's date is ${today}. A slip is never dated in the future; if a date reads later than today, you have misread it.

${formatCatalogue(categories, items)}`;
}
