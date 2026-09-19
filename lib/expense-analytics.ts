import type {
  CategorySeries,
  ConsumptionSeries,
  ExpenseAnalytics,
  ItemSeries,
  MonthInsight,
  PriceMove,
  PurchaseLearningItem,
  PurchaseRhythm,
  PurchaseRhythmEvent,
  RecurringGap,
  TopItem,
} from "@/types/expense";
import type { Expense } from "@/types/expense";
import { daysBetween, isValidDate as isValidCalendarDate, monthRange } from "@/lib/date";
import { median, round, sum } from "@/lib/numbers";

/**
 * Tuning for the "recurring, not logged" check. Exported so the heuristic is
 * visible and testable rather than buried as magic numbers.
 *
 * The check exists because entry here is manual and slip-driven: the danger
 * isn't a wrong number, it's a whole category silently missing for a month,
 * which makes every month-over-month comparison lie.
 */
export const RECURRING_LOOKBACK_MONTHS = 3;
/** Ignore small stuff — a forgotten ₹40 item isn't worth nagging about. */
export const RECURRING_MIN_TYPICAL_AMOUNT = 200;
/** Something bought more than this often in a month is a daily purchase,
 *  not a monthly commitment; its absence on a given day means nothing. */
export const RECURRING_MAX_ENTRIES_PER_MONTH = 3;
export const MAX_RECURRING_GAPS = 6;

/** A price move needs both months priced and enough spend to be worth reading. */
export const PRICE_MOVE_MIN_AMOUNT = 100;
export const MAX_PRICE_MOVES = 5;

/** How many biggest-spend items a month lists. */
export const MAX_TOP_ITEMS = 6;

/** Splitting a category by unit produces a long tail ("Groceries, 3 pcs")
 *  that carries no reading, so the payload keeps only the groups with real
 *  money behind them. The screen narrows this further to the ones that
 *  actually moved in the month being looked at. */
export const MAX_CONSUMPTION_GROUPS = 8;

/** Recent gaps describe the household's current rhythm better than its whole
 * history. Six still smooths over one unusually early or late purchase. */
export const RHYTHM_MAX_GAPS = 6;
/** Stop presenting an abandoned item as eternally due. Slow items such as an
 * LPG cylinder get a wider absolute window than fast groceries. */
export const RHYTHM_MIN_ACTIVE_DAYS = 30;
export const RHYTHM_ACTIVE_CYCLES = 2.5;
export const MAX_PURCHASE_RHYTHMS = 12;
export const MAX_RHYTHM_HISTORY = 12;
export const MAX_RHYTHM_COMPANIONS = 4;
export const RHYTHM_LEARNING_ACTIVE_DAYS = 90;
export const MAX_RHYTHM_LEARNING_ITEMS = 6;

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function daysInMonth(month: string): number {
  if (!MONTH_RE.test(month)) return 0;
  // Day 0 of the next month is the last day of this one.
  return new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
  ).getUTCDate();
}

/**
 * Items are keyed by item_id when the row is linked to the catalogue, so a
 * later rename keeps its history together. Free-text rows fall back to their
 * name.
 */
function itemKey(expense: Expense): string {
  return expense.item_id ? `id:${expense.item_id}` : `name:${expense.item_name}`;
}

/** The longest run of consecutive days with nothing logged, within the part
 *  of the month that has actually happened. */
export function longestGap(dates: Set<number>, upToDay: number): number {
  let longest = 0;
  let run = 0;

  for (let day = 1; day <= upToDay; day++) {
    if (dates.has(day)) {
      run = 0;
    } else {
      run += 1;
      if (run > longest) longest = run;
    }
  }

  return longest;
}

/**
 * Month-on-month percentage change for a whole series, one entry per month.
 * Null where there is nothing meaningful to compare against — the first month,
 * or a previous month of zero, where a percentage would be infinite rather
 * than large. Computed across every month so the value at the left edge of a
 * window still compares against the real previous month.
 */
export function deltaSeries(values: number[]): (number | null)[] {
  return values.map((value, i) => {
    if (i === 0) return null;

    const previous = values[i - 1];
    if (previous <= 0) return null;

    return round(((value - previous) / previous) * 100, 1);
  });
}

export interface Bucket {
  amount: number;
  quantity: number;
  /** Amount from rows that also carry a quantity — the only rows a per-unit
   *  rate may be derived from. */
  pricedAmount: number;
  pricedQuantity: number;
  entries: number;
}

export interface ItemMeta {
  name: string;
  category: string;
  /** Every unit this item has been logged in, with how often. */
  units: Map<string, number>;
}

/**
 * The unit an item's quantities may be summed in, or null when they may not
 * be. Two different units on one item means the numbers cannot legitimately
 * be added, so no quantity is reported at all and the UI flags it as
 * something to fix rather than quietly showing a wrong total.
 */
export function dominantUnit(meta: ItemMeta): string | null {
  return meta.units.size === 1 ? [...meta.units.keys()][0] : null;
}

function emptyBucket(): Bucket {
  return {
    amount: 0,
    quantity: 0,
    pricedAmount: 0,
    pricedQuantity: 0,
    entries: 0,
  };
}

function rateOf(bucket: Bucket): number | null {
  if (bucket.pricedQuantity <= 0 || bucket.pricedAmount <= 0) return null;
  return round(bucket.pricedAmount / bucket.pricedQuantity, 2);
}

export interface BuildAnalyticsOptions {
  /** "YYYY-MM-DD" — injected so month-in-progress maths is testable. */
  today: string;
  /** How many months the window shows, counting back from the latest month. */
  windowMonths: number;
  /** Line-item detail (items, consumption, price moves, recurring gaps) is
   *  user-level information, mirroring GET /api/expenses. */
  unlocked: boolean;
}

/**
 * Turns the raw expense rows into everything the insights screen renders.
 *
 * Series are built over every month that has data so a delta at the left edge
 * of the window still compares against the real previous month, then sliced to
 * the window at the end.
 */
export function buildExpenseAnalytics(
  expenses: Expense[],
  options: BuildAnalyticsOptions
): ExpenseAnalytics {
  const { today, windowMonths, unlocked } = options;
  const rows = expenses.filter((e) => isValidDate(e.expense_date));
  const nowMonth = isValidDate(today) ? monthOf(today) : "";

  if (rows.length === 0 || !nowMonth) {
    return {
      months: [],
      categories: [],
      items: [],
      consumption: [],
      rhythms: [],
      learningItems: [],
      unlocked,
    };
  }

  const dataMonths = rows.map((e) => monthOf(e.expense_date));
  const first = dataMonths.reduce((a, b) => (a < b ? a : b));
  const last = dataMonths.reduce((a, b) => (a > b ? a : b));
  const allMonths = monthRange(first, nowMonth > last ? nowMonth : last);
  const windowStart = Math.max(0, allMonths.length - Math.max(1, windowMonths));
  const months = allMonths.slice(windowStart);
  const indexOfMonth = new Map(allMonths.map((m, i) => [m, i]));

  // ---- totals, per month --------------------------------------------------
  const monthTotals = allMonths.map(() => 0);
  const monthEntries = allMonths.map(() => 0);
  const monthDays: Set<number>[] = allMonths.map(() => new Set<number>());
  const categoryByMonth = new Map<string, number[]>();

  for (const row of rows) {
    const i = indexOfMonth.get(monthOf(row.expense_date));
    if (i === undefined) continue;

    const amount = Number(row.amount) || 0;
    monthTotals[i] += amount;
    monthEntries[i] += 1;
    monthDays[i].add(Number(row.expense_date.slice(8, 10)));

    let series = categoryByMonth.get(row.category);
    if (!series) {
      series = allMonths.map(() => 0);
      categoryByMonth.set(row.category, series);
    }
    series[i] += amount;
  }

  // ---- per item, per month ------------------------------------------------
  const itemBuckets = new Map<string, Bucket[]>();
  const itemMeta = new Map<string, ItemMeta>();

  for (const row of rows) {
    const i = indexOfMonth.get(monthOf(row.expense_date));
    if (i === undefined) continue;
    // Lump rows deliberately have no item identity — they would pollute both
    // the consumption list and the recurring check.
    if (row.is_itemized === false) continue;

    const key = itemKey(row);
    let buckets = itemBuckets.get(key);
    if (!buckets) {
      buckets = allMonths.map(() => emptyBucket());
      itemBuckets.set(key, buckets);
      itemMeta.set(key, {
        name: row.item_name,
        category: row.category,
        units: new Map(),
      });
    }

    const meta = itemMeta.get(key) as ItemMeta;
    // Latest row wins the display name, so a renamed item reads current.
    meta.name = row.item_name;
    meta.category = row.category;

    const amount = Number(row.amount) || 0;
    const rawQuantity =
      row.quantity === null || row.quantity === undefined
        ? null
        : Number(row.quantity);
    const bucket = buckets[i];

    bucket.amount += amount;
    bucket.entries += 1;

    if (
      rawQuantity !== null &&
      Number.isFinite(rawQuantity) &&
      rawQuantity > 0 &&
      row.unit
    ) {
      meta.units.set(row.unit, (meta.units.get(row.unit) ?? 0) + 1);
      bucket.quantity += rawQuantity;
      // A row priced at 0 (slip recorded the weight but not the price) would
      // drag a rupees-per-kilo rate down, so it counts towards consumption
      // but never towards the rate.
      if (amount > 0) {
        bucket.pricedAmount += amount;
        bucket.pricedQuantity += rawQuantity;
      }
    }
  }

  const itemSeries: ItemSeries[] = [];

  for (const [key, buckets] of itemBuckets) {
    const meta = itemMeta.get(key) as ItemMeta;
    const unit = dominantUnit(meta);
    const mixedUnits = meta.units.size > 1;
    const windowed = buckets.slice(windowStart);

    itemSeries.push({
      key,
      name: meta.name,
      category: meta.category,
      unit,
      mixedUnits,
      amounts: windowed.map((b) => round(b.amount, 2)),
      quantities: windowed.map((b) =>
        unit && b.quantity > 0 ? round(b.quantity, 3) : null
      ),
      rates: windowed.map((b) => (unit ? rateOf(b) : null)),
      // The subset of spend and quantity that can legitimately be divided.
      // Blending a rate over the window has to use these, not the totals: a
      // row with a price but no weight (a mango bought by the basket) would
      // otherwise inflate the rupees-per-kilo, and a row with a weight but no
      // price would deflate it.
      pricedAmounts: windowed.map((b) => (unit ? round(b.pricedAmount, 2) : 0)),
      pricedQuantities: windowed.map((b) =>
        unit ? round(b.pricedQuantity, 3) : 0
      ),
      entries: windowed.map((b) => b.entries),
    });
  }

  itemSeries.sort((a, b) => sum(b.amounts) - sum(a.amounts));

  // ---- category-level consumption, only where the unit agrees -------------
  // The group carries its own category and unit, so the map key is never
  // parsed back apart — a category name containing the separator cannot
  // corrupt the grouping.
  const consumptionGroups = new Map<
    string,
    { category: string; unit: string; series: number[]; spend: number[] }
  >();

  for (const [key, buckets] of itemBuckets) {
    const meta = itemMeta.get(key) as ItemMeta;
    const unit = dominantUnit(meta);
    if (!unit) continue;

    const groupKey = `${meta.category}|${unit}`;
    let group = consumptionGroups.get(groupKey);
    if (!group) {
      group = {
        category: meta.category,
        unit,
        series: allMonths.map(() => 0),
        spend: allMonths.map(() => 0),
      };
      consumptionGroups.set(groupKey, group);
    }
    buckets.forEach((b, i) => {
      group.series[i] += b.quantity;
      group.spend[i] += b.amount;
    });
  }

  const consumption: ConsumptionSeries[] = [...consumptionGroups.values()]
    .map(({ category, unit, series, spend }) => ({
      category,
      unit,
      quantities: series.slice(windowStart).map((q) => round(q, 3)),
      amounts: spend.slice(windowStart).map((a) => round(a, 2)),
      deltaPcts: deltaSeries(series).slice(windowStart),
    }))
    .filter((c) => c.quantities.some((q) => q > 0))
    // Ranked by spend, not quantity: 45 L, 40 kg and 32 packets are not
    // comparable numbers, but the money behind them is.
    .sort((a, b) => sum(b.amounts) - sum(a.amounts))
    .slice(0, MAX_CONSUMPTION_GROUPS);

  const categories: CategorySeries[] = [...categoryByMonth.entries()]
    .map(([category, series]) => ({
      category,
      amounts: series.slice(windowStart).map((a) => round(a, 2)),
      deltaPcts: deltaSeries(series).slice(windowStart),
    }))
    .filter((c) => c.amounts.some((a) => a !== 0))
    .sort((a, b) => sum(b.amounts) - sum(a.amounts));

  // ---- the per-month narrative --------------------------------------------
  const todayDay = Number(today.slice(8, 10));

  const monthInsights: MonthInsight[] = months.map((month, windowIndex) => {
    const i = windowStart + windowIndex;
    const total = round(monthTotals[i], 2);
    const isCurrentMonth = month === nowMonth;
    const totalDays = daysInMonth(month);
    const elapsed = isCurrentMonth ? Math.min(todayDay, totalDays) : totalDays;
    const prevTotal = i > 0 ? monthTotals[i - 1] : 0;
    const hasPrev = i > 0 && monthEntries[i - 1] > 0;

    return {
      month,
      total,
      entryCount: monthEntries[i],
      daysWithEntries: monthDays[i].size,
      daysInMonth: totalDays,
      daysElapsed: elapsed,
      isCurrentMonth,
      avgPerDay: elapsed > 0 ? round(total / elapsed, 2) : 0,
      // Below a few days in, a run rate is noise rather than a forecast.
      projectedTotal:
        isCurrentMonth && elapsed >= 3 && elapsed < totalDays
          ? Math.round((total / elapsed) * totalDays)
          : null,
      deltaAmount: hasPrev ? round(total - prevTotal, 2) : null,
      deltaPct:
        hasPrev && prevTotal > 0
          ? round(((total - prevTotal) / prevTotal) * 100, 1)
          : null,
      longestGapDays: longestGap(monthDays[i], elapsed),
      topItems: unlocked ? findTopItems(i, itemBuckets, itemMeta) : [],
      missingRecurring: unlocked
        ? findRecurringGaps(i, itemBuckets, itemMeta)
        : [],
      priceMoves: unlocked ? findPriceMoves(i, itemBuckets, itemMeta) : [],
    };
  });

  const purchasePatterns = unlocked
    ? buildPurchasePatterns(rows, today)
    : { rhythms: [], learningItems: [] };

  return {
    months: monthInsights,
    categories,
    items: unlocked ? itemSeries : [],
    consumption: unlocked ? consumption : [],
    rhythms: purchasePatterns.rhythms,
    learningItems: purchasePatterns.learningItems,
    unlocked,
  };
}

interface RhythmDraft {
  key: string;
  name: string;
  category: string;
  latestDate: string;
  dates: Set<string>;
  units: Set<string>;
  unitlessQuantityDates: Set<string>;
  unitsByDate: Map<string, Set<string>>;
  quantitiesByDate: Map<string, number>;
  amountsByDate: Map<string, number>;
}

interface PurchasePatterns {
  rhythms: PurchaseRhythm[];
  learningItems: PurchaseLearningItem[];
}

function buildRhythmHistory(
  draft: RhythmDraft,
  dates: string[],
  basketItemsByDate: Map<string, Map<string, { name: string; amount: number }>>
): PurchaseRhythmEvent[] {
  return dates.map((date, index) => {
    const dateUnits = draft.unitsByDate.get(date);
    const mixesUnitlessAndNamed =
      (dateUnits?.size ?? 0) > 0 && draft.unitlessQuantityDates.has(date);
    const hasMixedUnits = (dateUnits?.size ?? 0) > 1 || mixesUnitlessAndNamed;
    const eventUnit =
      !hasMixedUnits && dateUnits?.size === 1 ? [...dateUnits][0] : null;

    return {
      date,
      amount: round(draft.amountsByDate.get(date) ?? 0, 2),
      quantity:
        draft.quantitiesByDate.has(date) && !hasMixedUnits
          ? round(draft.quantitiesByDate.get(date) ?? 0, 2) || null
          : null,
      unit: eventUnit,
      daysSincePrevious:
        index === 0 ? null : daysBetween(dates[index - 1], date),
      otherItems: [...(basketItemsByDate.get(date)?.entries() ?? [])]
        .filter(([basketKey]) => basketKey !== draft.key)
        .sort(
          ([, a], [, b]) =>
            b.amount - a.amount || a.name.localeCompare(b.name)
        )
        .slice(0, MAX_RHYTHM_COMPANIONS)
        .map(([, item]) => item.name),
    };
  });
}

/**
 * Finds repeat-purchase rhythms such as potatoes every few days or a gas
 * cylinder every few weeks. Multiple lines for the same item on one day are
 * one purchase event, and the median of recent intervals keeps a single odd
 * trip from distorting the answer.
 */
export function buildPurchasePatterns(
  expenses: Expense[],
  today: string
): PurchasePatterns {
  if (!isValidCalendarDate(today)) return { rhythms: [], learningItems: [] };

  const drafts = new Map<string, RhythmDraft>();
  const basketItemsByDate = new Map<
    string,
    Map<string, { name: string; amount: number }>
  >();

  for (const row of expenses) {
    if (!isValidCalendarDate(row.expense_date) || row.expense_date > today) {
      continue;
    }

    const key = itemKey(row);
    let basket = basketItemsByDate.get(row.expense_date);
    if (!basket) {
      basket = new Map();
      basketItemsByDate.set(row.expense_date, basket);
    }
    const basketItem = basket.get(key);
    basket.set(key, {
      name: row.item_name,
      amount: (basketItem?.amount ?? 0) + (Number(row.amount) || 0),
    });

    if (row.is_itemized === false) continue;

    let draft = drafts.get(key);
    if (!draft) {
      draft = {
        key,
        name: row.item_name,
        category: row.category,
        latestDate: row.expense_date,
        dates: new Set(),
        units: new Set(),
        unitlessQuantityDates: new Set(),
        unitsByDate: new Map(),
        quantitiesByDate: new Map(),
        amountsByDate: new Map(),
      };
      drafts.set(key, draft);
    }

    if (row.expense_date >= draft.latestDate) {
      draft.name = row.item_name;
      draft.category = row.category;
      draft.latestDate = row.expense_date;
    }
    draft.dates.add(row.expense_date);
    draft.amountsByDate.set(
      row.expense_date,
      (draft.amountsByDate.get(row.expense_date) ?? 0) +
        (Number(row.amount) || 0)
    );

    const quantity = Number(row.quantity);
    if (Number.isFinite(quantity) && quantity > 0) {
      if (row.unit) {
        draft.units.add(row.unit);
        let dateUnits = draft.unitsByDate.get(row.expense_date);
        if (!dateUnits) {
          dateUnits = new Set();
          draft.unitsByDate.set(row.expense_date, dateUnits);
        }
        dateUnits.add(row.unit);
      } else {
        draft.unitlessQuantityDates.add(row.expense_date);
      }
      draft.quantitiesByDate.set(
        row.expense_date,
        (draft.quantitiesByDate.get(row.expense_date) ?? 0) + quantity
      );
    }
  }

  const rhythms: PurchaseRhythm[] = [];
  const learningItems: PurchaseLearningItem[] = [];

  for (const draft of drafts.values()) {
    const dates = [...draft.dates].sort();
    const fullHistory = buildRhythmHistory(draft, dates, basketItemsByDate);

    if (dates.length === 1) {
      const lastBoughtOn = dates[0];
      const daysSinceLast = daysBetween(lastBoughtOn, today);
      const firstEvent = fullHistory[0];

      // A measured item has a plausible repeat-use story (including a
      // unitless "1" for an LPG cylinder). Unmeasured one-off bills and help
      // payments stay out of a household replenishment screen.
      if (
        daysSinceLast <= RHYTHM_LEARNING_ACTIVE_DAYS &&
        firstEvent.quantity !== null
      ) {
        learningItems.push({
          key: draft.key,
          name: draft.name,
          category: draft.category,
          lastBoughtOn,
          daysSinceLast,
          purchaseCount: 1,
          history: fullHistory,
          historyTruncated: false,
        });
      }
      continue;
    }

    const gaps = dates
      .slice(1)
      .map((date, index) => daysBetween(dates[index], date))
      .filter((days) => days > 0);
    if (gaps.length === 0) continue;

    const recentGaps = gaps.slice(-RHYTHM_MAX_GAPS);
    const typicalDays = Math.max(1, Math.round(median(recentGaps)));
    const lastBoughtOn = dates.at(-1) as string;
    const daysSinceLast = daysBetween(lastBoughtOn, today);

    // An item absent for several of its own cycles is more likely no longer
    // part of the household routine than genuinely waiting to be bought.
    const activeForDays = Math.max(
      RHYTHM_MIN_ACTIVE_DAYS,
      Math.ceil(typicalDays * RHYTHM_ACTIVE_CYCLES)
    );
    if (daysSinceLast > activeForDays) continue;

    const dueInDays = typicalDays - daysSinceLast;
    const soonWithinDays = Math.max(2, Math.ceil(typicalDays * 0.2));
    const timing = dueInDays <= 0 ? "now" : dueInDays <= soonWithinDays ? "soon" : "later";
    const hasUnitlessQuantities = draft.unitlessQuantityDates.size > 0;
    const quantitiesAgree =
      (draft.units.size === 1 && !hasUnitlessQuantities) ||
      draft.units.size === 0;
    const unit =
      draft.units.size === 1 && !hasUnitlessQuantities
        ? [...draft.units][0]
        : null;
    const quantities = quantitiesAgree
      ? [...draft.quantitiesByDate.values()]
      : [];

    rhythms.push({
      key: draft.key,
      name: draft.name,
      category: draft.category,
      typicalDays,
      lastGapDays: gaps.at(-1) as number,
      recentMinDays: Math.min(...recentGaps),
      recentMaxDays: Math.max(...recentGaps),
      lastBoughtOn,
      daysSinceLast,
      dueInDays,
      timing,
      cycleProgressPct: Math.min(
        100,
        Math.max(0, Math.round((daysSinceLast / typicalDays) * 100))
      ),
      purchaseCount: dates.length,
      intervalCount: gaps.length,
      typicalQuantity:
        quantities.length > 0 ? round(median(quantities), 2) : null,
      unit,
      history: fullHistory.slice(-MAX_RHYTHM_HISTORY).reverse(),
      historyTruncated: fullHistory.length > MAX_RHYTHM_HISTORY,
    });
  }

  const timingRank = { now: 0, soon: 1, later: 2 } as const;

  const rankedRhythms = rhythms
    .sort(
      (a, b) =>
        timingRank[a.timing] - timingRank[b.timing] ||
        a.dueInDays - b.dueInDays ||
        b.purchaseCount - a.purchaseCount ||
        a.name.localeCompare(b.name)
    )
    .slice(0, MAX_PURCHASE_RHYTHMS);

  const rankedLearningItems = learningItems
    .sort(
      (a, b) =>
        (b.history[0]?.amount ?? 0) - (a.history[0]?.amount ?? 0) ||
        b.lastBoughtOn.localeCompare(a.lastBoughtOn) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, MAX_RHYTHM_LEARNING_ITEMS);

  return { rhythms: rankedRhythms, learningItems: rankedLearningItems };
}

export function buildPurchaseRhythms(
  expenses: Expense[],
  today: string
): PurchaseRhythm[] {
  return buildPurchasePatterns(expenses, today).rhythms;
}

/**
 * Things that look like a monthly commitment (a salary, a bill, the milk) and
 * were logged in recent months but are absent from this one.
 *
 * Manual slip entry fails by omission, not by wrong numbers: one forgotten
 * category makes every month-over-month figure on this screen wrong. The
 * filters keep it to commitments — items bought many times a month are daily
 * shopping, and small amounts are not worth chasing.
 */
export function findRecurringGaps(
  monthIndex: number,
  itemBuckets: Map<string, Bucket[]>,
  itemMeta: Map<string, ItemMeta>
): RecurringGap[] {
  if (monthIndex === 0) return [];

  const from = Math.max(0, monthIndex - RECURRING_LOOKBACK_MONTHS);
  const gaps: RecurringGap[] = [];

  for (const [key, buckets] of itemBuckets) {
    if (buckets[monthIndex].entries > 0) continue;

    const previous = buckets.slice(from, monthIndex);
    const monthsWithData = previous.filter((b) => b.entries > 0);
    if (monthsWithData.length === 0) continue;

    // Present in at least half of the recent months that had any activity.
    const activeMonths = previous.length;
    if (monthsWithData.length * 2 < activeMonths) continue;

    const busiest = Math.max(...monthsWithData.map((b) => b.entries));
    if (busiest > RECURRING_MAX_ENTRIES_PER_MONTH) continue;

    const typicalAmount = Math.round(
      median(monthsWithData.map((b) => b.amount))
    );
    if (typicalAmount < RECURRING_MIN_TYPICAL_AMOUNT) continue;

    const meta = itemMeta.get(key) as ItemMeta;
    gaps.push({
      name: meta.name,
      category: meta.category,
      monthsSeen: monthsWithData.length,
      typicalAmount,
    });
  }

  return gaps
    .sort((a, b) => b.typicalAmount - a.typicalAmount)
    .slice(0, MAX_RECURRING_GAPS);
}

/**
 * Items whose rupees-per-unit moved most against the previous month — the
 * payoff for recording quantities at all, since it separates "we spent more"
 * from "it got more expensive".
 */
export function findPriceMoves(
  monthIndex: number,
  itemBuckets: Map<string, Bucket[]>,
  itemMeta: Map<string, ItemMeta>
): PriceMove[] {
  if (monthIndex === 0) return [];

  const moves: PriceMove[] = [];

  for (const [key, buckets] of itemBuckets) {
    const meta = itemMeta.get(key) as ItemMeta;
    const unit = dominantUnit(meta);
    if (!unit) continue;

    const now = buckets[monthIndex];
    const before = buckets[monthIndex - 1];
    const rate = rateOf(now);
    const prevRate = rateOf(before);
    if (rate === null || prevRate === null) continue;
    if (now.pricedAmount < PRICE_MOVE_MIN_AMOUNT) continue;
    if (rate === prevRate) continue;

    moves.push({
      name: meta.name,
      unit,
      rate,
      prevRate,
      deltaPct: round(((rate - prevRate) / prevRate) * 100, 1),
    });
  }

  return moves
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, MAX_PRICE_MOVES);
}

/** What a month's money actually went on, biggest first. */
export function findTopItems(
  monthIndex: number,
  itemBuckets: Map<string, Bucket[]>,
  itemMeta: Map<string, ItemMeta>
): TopItem[] {
  const items: TopItem[] = [];

  for (const [key, buckets] of itemBuckets) {
    const amount = buckets[monthIndex].amount;
    if (amount <= 0) continue;

    const meta = itemMeta.get(key) as ItemMeta;
    items.push({ name: meta.name, category: meta.category, amount });
  }

  return items.sort((a, b) => b.amount - a.amount).slice(0, MAX_TOP_ITEMS);
}
