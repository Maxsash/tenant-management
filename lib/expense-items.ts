import type { Expense, ExpenseItem } from "@/types/expense";

/**
 * Ranking the catalogue by what actually gets bought.
 *
 * The item picker used to show nothing at all until you typed something,
 * which asks the person logging an expense to already know what the catalogue
 * calls the thing in their hand. A household buys the same twenty things over
 * and over, so the honest default for an empty search box is those twenty.
 */

/**
 * How much a purchase still counts toward "we buy this often", by how long
 * ago it was. A tomato bought last week says more about tomorrow's shopping
 * than one bought last spring, but not so much more that a seasonal staple
 * falls off the list entirely.
 */
export const USAGE_WEIGHTS = [
  { withinDays: 30, weight: 1 },
  { withinDays: 90, weight: 0.5 },
  { withinDays: 365, weight: 0.25 },
] as const;

/** Older than the last bucket still counts, just barely. */
export const RESIDUAL_WEIGHT = 0.05;

export const DEFAULT_SUGGESTION_LIMIT = 12;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number | null {
  const fromTime = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const toTime = new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime();

  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return null;

  return (toTime - fromTime) / MS_PER_DAY;
}

function weightFor(ageInDays: number): number {
  for (const bucket of USAGE_WEIGHTS) {
    if (ageInDays <= bucket.withinDays) return bucket.weight;
  }

  return RESIDUAL_WEIGHT;
}

export interface RankedItem {
  item: ExpenseItem;
  score: number;
  /** Most recent purchase date, or null if this item has never been logged. */
  lastUsed: string | null;
}

/**
 * Scores every item by recency-weighted purchase count. Items never bought
 * score 0 and sort last, alphabetically, so the full catalogue is still
 * browsable underneath the suggestions.
 *
 * Only expenses linked to the catalogue by `item_id` count — a free-text row
 * that happens to share a name is a different thing by construction, and
 * lib/expense-analytics.ts already treats it as one.
 */
export function rankItemsByUsage(
  items: ExpenseItem[],
  expenses: Expense[],
  today: string
): RankedItem[] {
  const scores = new Map<string, { score: number; lastUsed: string | null }>();

  for (const expense of expenses) {
    if (!expense.item_id) continue;

    const age = daysBetween(expense.expense_date, today);
    // A date the app cannot parse, or one in the future, tells us nothing
    // about how recently this was bought — count it at the residual weight
    // rather than letting it top the list.
    const weight = age === null || age < 0 ? RESIDUAL_WEIGHT : weightFor(age);

    const existing = scores.get(expense.item_id) ?? { score: 0, lastUsed: null };

    scores.set(expense.item_id, {
      score: existing.score + weight,
      lastUsed:
        existing.lastUsed && existing.lastUsed >= expense.expense_date
          ? existing.lastUsed
          : expense.expense_date,
    });
  }

  return items
    .map((item) => {
      const entry = scores.get(item.id);

      return {
        item,
        score: entry?.score ?? 0,
        lastUsed: entry?.lastUsed ?? null,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.lastUsed !== b.lastUsed) return (b.lastUsed ?? "").localeCompare(a.lastUsed ?? "");
      return a.item.name.localeCompare(b.item.name);
    });
}

/**
 * The shortlist the picker opens on: the most-bought items, and nothing at
 * all if this household has no history yet (an arbitrary alphabetical dozen
 * would be worse than an honest empty state).
 */
export function suggestItems(
  items: ExpenseItem[],
  expenses: Expense[],
  today: string,
  limit: number = DEFAULT_SUGGESTION_LIMIT
): ExpenseItem[] {
  return rankItemsByUsage(items, expenses, today)
    .filter((ranked) => ranked.score > 0)
    .slice(0, limit)
    .map((ranked) => ranked.item);
}
