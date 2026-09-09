import { normalizeMeasure, unitsAgree } from "@/lib/units";
import type { ExpenseCategory, ExpenseItem } from "@/types/expense";
import type {
  SlipDraft,
  SlipDraftLine,
  SlipExtraction,
  SlipLine,
  SlipReviewReason,
} from "@/types/slip";

/**
 * Turning what a vision model read off a handwritten slip into rows that
 * point at the real catalogue.
 *
 * The link that matters is `item_id`: lib/expense-analytics.ts keys an item's
 * history by it and only falls back to the name, so a slip line that lands as
 * free text starts a second, parallel history for something already tracked.
 * Matching therefore leans towards finding the catalogue entry — but every
 * match it is not certain of comes back flagged, because silently attaching a
 * line to the wrong item is worse than asking.
 */

/**
 * Tuning for the fuzzy name match. Exported rather than inlined because the
 * numbers are a judgement call about Hinglish spelling drift, not a fact.
 */
export const MATCH_TUNING = {
  /** Folded-name similarity below this is not a match at all. */
  minSimilarity: 0.78,
  /** A win narrower than this over the runner-up is treated as ambiguous. */
  minLead: 0.06,
  /** A catalogue name appearing anywhere inside a longer slip line must be at
   *  least this long, so "Aam" does not claim "Badaam ki barfi". */
  minContainsLength: 5,
  /** A catalogue name that opens the slip phrase can be shorter, because
   *  starting it is far stronger evidence than merely occurring in it:
   *  "Dona ke nau ke" is the item Dona with a note about who it went to. */
  minPrefixLength: 3,
} as const;

/**
 * Folds the spelling variance in Hindi transliterated to Latin script, where
 * the same word is written several ways on different slips: Aaloo / Aalu /
 * Alu, Pyaaz / Pyaz. Long vowels collapse to short ones, then any remaining
 * doubled letter collapses, so all the spellings of one word converge.
 */
export function foldName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/oo/g, "u")
    .replace(/ee/g, "i")
    .replace(/(.)\1+/g, "$1");
}

/** Levenshtein distance, two-row form. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, substitution);
    }

    previous = current;
  }

  return previous[b.length];
}

/** 1 for identical strings, 0 for nothing in common. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;

  return 1 - editDistance(a, b) / longest;
}

export type SlipMatchKind = "exact" | "fuzzy" | "ambiguous";

export interface SlipMatch {
  item: ExpenseItem;
  kind: SlipMatchKind;
  /** The item that came second, when it came close enough to be worth naming. */
  runnerUp: ExpenseItem | null;
}

/**
 * Finds the catalogue item a slip line is talking about, or null.
 *
 * Only an `exact` result is safe to save unattended. A `fuzzy` one is a
 * suggestion; an `ambiguous` one means a second item scored nearly as well,
 * so the suggestion is offered but the caller is told it is a coin toss
 * rather than a read.
 */
export function matchCatalogueItem(
  name: string,
  items: ExpenseItem[]
): SlipMatch | null {
  const folded = foldName(name);
  if (!folded) return null;

  let best: { item: ExpenseItem; score: number } | null = null;
  let runnerUp: { item: ExpenseItem; score: number } | null = null;

  for (const item of items) {
    const candidate = foldName(item.name);
    if (!candidate) continue;

    if (candidate === folded) {
      return { item, kind: "exact", runnerUp: null };
    }

    // A catalogue name written inside a longer slip phrase ("amul butter
    // 100g") is a strong signal, but only once the name is long enough that
    // the containment cannot be coincidence.
    const contained =
      candidate.length >= MATCH_TUNING.minContainsLength &&
      (folded.includes(candidate) || candidate.includes(folded));

    // A slip habitually names the thing and then who or what it was for
    // ("Dona ke nau ke"). Opening the phrase on a whole word is much stronger
    // evidence than appearing somewhere in the middle of it, so it earns the
    // same weight from a shorter name.
    const prefixed =
      candidate.length >= MATCH_TUNING.minPrefixLength &&
      (folded.startsWith(`${candidate} `) || candidate.startsWith(`${folded} `));

    const score =
      contained || prefixed
        ? Math.max(0.9, similarity(folded, candidate))
        : similarity(folded, candidate);

    if (!best || score > best.score) {
      runnerUp = best;
      best = { item, score };
    } else if (!runnerUp || score > runnerUp.score) {
      runnerUp = { item, score };
    }
  }

  if (!best || best.score < MATCH_TUNING.minSimilarity) return null;

  // Two plausible items and nothing much to separate them.
  const contender =
    runnerUp !== null &&
    runnerUp.score >= MATCH_TUNING.minSimilarity &&
    best.score - runnerUp.score < MATCH_TUNING.minLead
      ? runnerUp.item
      : null;

  return {
    item: best.item,
    kind: contender ? "ambiguous" : "fuzzy",
    runnerUp: contender,
  };
}

/**
 * Picks the category for a line nothing matched. The model's suggestion is
 * only honoured when it names a category that really exists — it is not
 * allowed to invent one, since `expenses.category` is free text and a typo
 * would quietly split a category in two.
 */
export function resolveCategory(
  suggested: string | null | undefined,
  categories: ExpenseCategory[]
): string {
  const guess = suggested?.trim().toLowerCase();

  if (guess) {
    const known = categories.find((c) => c.name.toLowerCase() === guess);
    if (known) return known.name;
  }

  const other = categories.find((c) => c.name.toLowerCase() === "other");

  return other?.name ?? categories[0]?.name ?? "Other";
}

function buildLine(
  line: SlipLine,
  index: number,
  items: ExpenseItem[],
  categories: ExpenseCategory[],
  expense_date: string
): SlipDraftLine {
  const reviewReasons: SlipReviewReason[] = [];
  const match = matchCatalogueItem(line.item_name, items);
  const measure = normalizeMeasure(line.quantity, line.unit);

  let unit = measure.unit;

  if (match) {
    if (match.kind === "fuzzy") reviewReasons.push("fuzzy-match");
    if (match.kind === "ambiguous") reviewReasons.push("ambiguous-match");

    // An item logged in one unit everywhere else should keep being logged in
    // it, so a slip that omitted the unit inherits the catalogue's rather
    // than storing a bare number.
    if (!unit && measure.quantity !== null) {
      unit = match.item.default_unit ?? null;
    } else if (
      unit &&
      match.item.default_unit &&
      !unitsAgree(unit, match.item.default_unit)
    ) {
      reviewReasons.push("unit-differs");
    }
  } else {
    reviewReasons.push("no-match");
  }

  const amount =
    typeof line.amount === "number" && Number.isFinite(line.amount) && line.amount > 0
      ? line.amount
      : 0;

  if (amount === 0) reviewReasons.push("no-amount");

  return {
    id: `slip-line-${index}`,
    raw_text: line.raw_text,
    expense_date,
    item_id: match?.item.id ?? null,
    // A match renames the line to the catalogue's spelling, which is what
    // keeps "Aaloo" and "Aalu" reading as one item in the list.
    item_name: match?.item.name ?? line.item_name.trim(),
    category: match?.item.category ?? resolveCategory(line.category, categories),
    quantity: measure.quantity,
    unit,
    amount,
    reviewReasons,
  };
}

export interface BuildSlipDraftOptions {
  items: ExpenseItem[];
  categories: ExpenseCategory[];
  /** Used when the slip carries no legible date of its own. */
  fallbackDate: string;
}

/** Rupee slack when comparing a slip's own total against its lines. */
export const TOTALS_TOLERANCE = 1;

/**
 * Whether a slip's stated total still squares with what its lines add up to.
 * Shared with the review screen so the check does not drift between the read
 * and the correcting of it.
 */
export function totalsAgree(stated: number | null, actual: number): boolean | null {
  if (stated === null) return null;

  return Math.abs(stated - actual) <= TOTALS_TOLERANCE;
}

/**
 * Assembles the review-screen draft: every line matched and normalised, plus
 * the arithmetic check between what the slip claims it totalled and what its
 * lines actually add up to. That check is the one that catches a whole line
 * having been missed, which no per-line confidence can.
 */
export function buildSlipDraft(
  extraction: SlipExtraction,
  { items, categories, fallbackDate }: BuildSlipDraftOptions
): SlipDraft {
  const slipDate = isIsoDate(extraction.slip_date) ? extraction.slip_date! : null;

  // A running page writes a date once and dittos it down the lines beneath.
  // The model is asked to carry it down itself, but a line it could not read a
  // date for inherits the last one we did see rather than silently landing on
  // today — which, on a page straddling a month end, would move real spending
  // into the wrong month.
  let carried = slipDate ?? fallbackDate;

  const lines = (extraction.lines ?? []).map((line, index) => {
    if (isIsoDate(line.line_date)) carried = line.line_date!;

    return buildLine(line, index, items, categories, carried);
  });

  const linesTotal = Math.round(
    lines.reduce((sum, line) => sum + line.amount, 0)
  );

  const statedTotal =
    typeof extraction.stated_total === "number" &&
    Number.isFinite(extraction.stated_total)
      ? extraction.stated_total
      : null;

  const dates = new Set(lines.map((line) => line.expense_date));

  return {
    // The header opens on whichever date most of the lines share, so the
    // common case of a single-day slip still needs no thought.
    expense_date: commonestDate(lines) ?? slipDate ?? fallbackDate,
    spansMultipleDates: dates.size > 1,
    lines,
    linesTotal,
    statedTotal,
    totalsAgree: totalsAgree(statedTotal, linesTotal),
    unreadable: extraction.unreadable?.trim() || null,
  };
}

/** The date the most lines carry; ties go to the earliest, for stability. */
function commonestDate(lines: SlipDraftLine[]): string | null {
  const counts = new Map<string, number>();

  for (const line of lines) {
    counts.set(line.expense_date, (counts.get(line.expense_date) ?? 0) + 1);
  }

  let best: { date: string; count: number } | null = null;

  for (const [date, count] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!best || count > best.count) best = { date, count };
  }

  return best?.date ?? null;
}

function isIsoDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime());
}
