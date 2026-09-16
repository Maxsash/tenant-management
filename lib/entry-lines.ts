import type { Expense, ExpenseItem } from "@/types/expense";
import type { SlipDraft, SlipReviewReason } from "@/types/slip";
import type { ExpenseMode } from "@/lib/expenses";

/**
 * The editable line behind the entry sheet.
 *
 * One slip is one date and one payment method with many lines on it, so that
 * is what the sheet edits: a basket, not a form you reopen per item. A single
 * expense is just a basket of one, and a photographed slip is a basket that
 * arrives already filled in.
 *
 * Numbers are held as strings because these are bound straight to text
 * inputs, and a half-typed "1." is a legitimate intermediate state that a
 * number would round away under the user's fingers.
 */
export interface EntryLine {
  id: string;
  /** Every line carries its own date: one photographed page routinely covers
   *  several days, and collapsing them would move spending between months. */
  date: string;
  mode: ExpenseMode;
  /** Set only for a "pick" line — the catalogue link analytics groups on. */
  item_id: string | null;
  item_name: string;
  category: string;
  quantity: string;
  unit: string;
  amount: string;
  notes: string | null;
  /** Carried over from a scanned slip so the sheet can flag what to check. */
  reviewReasons: SlipReviewReason[];
}

export interface EntryLineSeed {
  id: string;
  date: string;
  mode?: ExpenseMode;
  item_id?: string | null;
  item_name?: string;
  category?: string;
  quantity?: string;
  unit?: string;
  amount?: string;
  notes?: string | null;
  reviewReasons?: SlipReviewReason[];
}

export function createEntryLine(seed: EntryLineSeed): EntryLine {
  return {
    id: seed.id,
    date: seed.date,
    mode: seed.mode ?? "pick",
    item_id: seed.item_id ?? null,
    item_name: seed.item_name ?? "",
    category: seed.category ?? "",
    quantity: seed.quantity ?? "",
    unit: seed.unit ?? "",
    amount: seed.amount ?? "",
    notes: seed.notes ?? null,
    reviewReasons: seed.reviewReasons ?? [],
  };
}

/** Applies a catalogue pick, adopting the item's usual unit as the default. */
export function applyItemToLine(line: EntryLine, item: ExpenseItem): EntryLine {
  return {
    ...line,
    mode: "pick",
    item_id: item.id,
    item_name: item.name,
    category: item.category,
    // Only fills a blank — someone who already typed "2 packet" meant it.
    unit: line.unit || item.default_unit || "",
    // Picking an item settles whatever the scan was unsure about.
    reviewReasons: line.reviewReasons.filter(
      (reason) => reason !== "no-match" && reason !== "fuzzy-match" && reason !== "ambiguous-match"
    ),
  };
}

/**
 * Moves a line to another day. Correcting the date settles a scan's doubt
 * about it, the same way picking an item settles a doubtful match.
 */
export function withLineDate(line: EntryLine, date: string): EntryLine {
  return {
    ...line,
    date,
    reviewReasons: line.reviewReasons.filter((reason) => reason !== "date-check"),
  };
}

/** Turns a scanned slip into the sheet's lines, review flags and all. */
export function slipDraftToEntryLines(draft: SlipDraft): EntryLine[] {
  return draft.lines.map((line) =>
    createEntryLine({
      id: line.id,
      date: line.expense_date,
      mode: line.item_id ? "pick" : "custom",
      item_id: line.item_id,
      item_name: line.item_name,
      category: line.category,
      quantity: line.quantity === null ? "" : String(line.quantity),
      unit: line.unit ?? "",
      amount: line.amount > 0 ? String(line.amount) : "",
      // The slip's own wording becomes the note, so it survives the save and
      // a figure stays checkable against the paper months later — the same
      // thing the July import did with its `notes` column.
      notes: line.raw_text || null,
      reviewReasons: line.reviewReasons,
    })
  );
}

/**
 * Opens an existing expense for editing. The mode has to be re-derived rather
 * than stored, because it is not a column — the same rule the form dialog
 * used, kept in one place now that two screens need it.
 */
export function expenseToEntryLine(
  expense: Expense,
  items: ExpenseItem[]
): EntryLine {
  const matched = expense.item_id
    ? items.find((i) => i.id === expense.item_id)
    : undefined;

  const mode: ExpenseMode =
    expense.is_itemized === false ? "lump" : matched ? "pick" : "custom";

  return createEntryLine({
    id: expense.id,
    date: expense.expense_date.slice(0, 10),
    mode,
    item_id: matched?.id ?? null,
    item_name: expense.item_name,
    category: matched?.category ?? expense.category,
    quantity:
      expense.quantity === null || expense.quantity === undefined
        ? ""
        : String(expense.quantity),
    unit: expense.unit ?? "",
    amount: String(expense.amount),
    notes: expense.notes ?? null,
  });
}

/** The shape /api/expenses/bulk and /api/expenses both take for one line. */
export interface EntryLinePayload {
  expense_date: string;
  mode: ExpenseMode;
  item_id: string | null;
  custom_name: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  amount: number;
  notes: string | null;
}

export function entryLineToPayload(line: EntryLine): EntryLinePayload {
  const quantity = line.quantity.trim();

  return {
    expense_date: line.date,
    mode: line.mode,
    item_id: line.mode === "pick" ? line.item_id : null,
    custom_name: line.mode === "custom" ? line.item_name.trim() : null,
    category: line.mode === "pick" ? null : line.category,
    quantity: quantity === "" ? null : Number(quantity),
    unit: line.unit.trim() || null,
    amount: Number(line.amount),
    notes: line.notes?.trim() || null,
  };
}

/** A line nobody has touched yet, so an empty trailing row is not an error. */
export function isBlankLine(line: EntryLine): boolean {
  return (
    line.amount.trim() === "" &&
    line.item_name.trim() === "" &&
    line.item_id === null
  );
}

/** What the basket comes to. Rounded once, at the end. */
export function entryLinesTotal(lines: EntryLine[]): number {
  const total = lines.reduce((sum, line) => {
    const amount = Number(line.amount);

    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return Math.round(total * 100) / 100;
}

/**
 * What each scan flag means, in words the person holding the slip can act on.
 * Kept beside the line logic rather than in the row component so the wording
 * stays in one place as reasons are added.
 */
export const REVIEW_REASON_LABELS: Record<SlipReviewReason, string> = {
  "no-match": "New item — check the name and category",
  "fuzzy-match": "Close guess — check it is the right item",
  "ambiguous-match": "Two items fit this — check which",
  "unit-differs": "Unusual unit for this item",
  "no-amount": "Could not read the amount",
  "date-check": "Date looks out of place — check it against the slip",
};

/** This line's flags as sentences, in the order the scan raised them. */
export function describeReviewReasons(line: EntryLine): string[] {
  return line.reviewReasons.map((reason) => REVIEW_REASON_LABELS[reason]);
}

export interface EntryLineDateGroup {
  date: string;
  lines: EntryLine[];
}

/**
 * Splits the basket into one group per day, so the sheet can head each day
 * the way the paper does. Days appear in the order the page first reaches
 * them rather than sorted, so a photographed page reads back in the order it
 * was written.
 *
 * A line moved to a day that already has a group joins that group rather
 * than starting a second heading for the same day — which is what moving a
 * single misdated line is for.
 */
export function groupLinesByDate(lines: EntryLine[]): EntryLineDateGroup[] {
  const groups = new Map<string, EntryLineDateGroup>();

  for (const line of lines) {
    const group = groups.get(line.date);

    if (group) group.lines.push(line);
    else groups.set(line.date, { date: line.date, lines: [line] });
  }

  return [...groups.values()];
}

/** True when the basket covers more than one day, i.e. a running page. */
export function spansMultipleDates(lines: EntryLine[]): boolean {
  return new Set(lines.map((line) => line.date)).size > 1;
}

/** The first and last day the basket covers, for a summary of a running page. */
export function entryLinesDateRange(
  lines: EntryLine[]
): { from: string; to: string } | null {
  const dates = lines.map((line) => line.date).filter(Boolean).sort();

  if (dates.length === 0) return null;

  return { from: dates[0], to: dates[dates.length - 1] };
}

export interface EntryLineProblem {
  lineId: string;
  message: string;
}

/**
 * The check the Save button reads. Deliberately the same rules the bulk route
 * enforces, so the sheet can say which line is wrong before a round trip —
 * the route stays the authority, this just spares the user a blind rejection.
 */
export function findLineProblem(line: EntryLine): string | null {
  const amount = Number(line.amount);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(line.date)) return "Needs a date";
  if (!line.amount.trim()) return "Needs an amount";
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be more than zero";

  if (line.mode === "pick" && !line.item_id) return "Pick an item";
  if (line.mode === "custom" && !line.item_name.trim()) return "Needs a name";
  if (line.mode !== "pick" && !line.category) return "Needs a category";

  if (line.quantity.trim() && !Number.isFinite(Number(line.quantity))) {
    return "Quantity is not a number";
  }

  return null;
}

/**
 * Validates the whole basket. Blank trailing lines are dropped rather than
 * rejected, so tapping "add line" once too often is not an error to resolve.
 */
export function validateEntryLines(lines: EntryLine[]): {
  lines: EntryLine[];
  problems: EntryLineProblem[];
} {
  const filled = lines.filter((line) => !isBlankLine(line));

  const problems = filled
    .map((line) => {
      const message = findLineProblem(line);

      return message ? { lineId: line.id, message } : null;
    })
    .filter((problem): problem is EntryLineProblem => problem !== null);

  return { lines: filled, problems };
}
