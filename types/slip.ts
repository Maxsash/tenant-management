/**
 * Shapes for the photograph-a-slip flow: what the vision model is asked to
 * return, and what the review screen is handed after those raw lines have
 * been matched against the catalogue.
 */

/** One handwritten line, exactly as the model read it. */
export interface SlipLine {
  /** The slip's own wording, kept verbatim so a mis-read stays checkable. */
  raw_text: string;
  /** This line's date, carried down from the last one written on the page. */
  line_date: string | null;
  item_name: string;
  /** The model's best category guess; only consulted when nothing matches. */
  category: string | null;
  quantity: number | null;
  unit: string | null;
  amount: number;
}

/** The whole slip, straight off the model, before any of our own logic. */
export interface SlipExtraction {
  /** Set only when one date covers the whole slip; null for a running page. */
  slip_date: string | null;
  /** The total the slip itself claims, when it writes one down. */
  stated_total: number | null;
  lines: SlipLine[];
  /** Anything the model could not read, in its own words. */
  unreadable: string | null;
}

/** Why a line is worth a second look before it is saved. */
export type SlipReviewReason =
  | "no-match"
  | "fuzzy-match"
  | "ambiguous-match"
  | "unit-differs"
  | "no-amount";

export interface SlipDraftLine {
  /** Stable key for the review list; not persisted. */
  id: string;
  raw_text: string;
  /** Every line carries its own date: one page routinely spans several days. */
  expense_date: string;
  /** Set only on a catalogue match — that link is what keeps item history together. */
  item_id: string | null;
  item_name: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  amount: number;
  /** Populated for every line the user should check, empty when clean. */
  reviewReasons: SlipReviewReason[];
}

export interface SlipDraft {
  /** The commonest date across the lines — what the sheet header opens on. */
  expense_date: string;
  /** True when the lines do not all share a date, i.e. a running page. */
  spansMultipleDates: boolean;
  lines: SlipDraftLine[];
  /** Sum of the lines we produced. */
  linesTotal: number;
  statedTotal: number | null;
  /** Null when the slip stated no total to compare against. */
  totalsAgree: boolean | null;
  unreadable: string | null;
}
