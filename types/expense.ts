export type PaymentMethod = "Cash" | "UPI" | "Card" | "Bank Transfer";

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  active: boolean;
}

export interface ExpenseItem {
  id: string;
  name: string;
  category: string;
  default_unit?: string | null;
  active: boolean;
  created_at?: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  item_id?: string | null;
  item_name: string;
  category: string;
  quantity?: number | null;
  unit?: string | null;
  amount: number;
  payment_method: PaymentMethod | string;
  notes?: string | null;
  is_itemized: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  pct: number;
}

/**
 * Analytics shapes. Every `*s: T[]` series below is index-aligned with
 * `ExpenseAnalytics.months`, so position i in any array is the same month.
 * A null means "no reading for that month", never zero.
 */
export interface RecurringGap {
  name: string;
  category: string;
  /** How many of the recent months it was logged in. */
  monthsSeen: number;
  /** Median of its monthly totals in those months. */
  typicalAmount: number;
}

export interface PriceMove {
  name: string;
  unit: string;
  rate: number;
  prevRate: number;
  deltaPct: number;
}

export interface TopItem {
  name: string;
  category: string;
  amount: number;
}

/**
 * Where an item sits in its usual cycle. "lapsed" means a whole extra cycle
 * has gone by without a purchase: more likely dropped from the routine, or
 * bought without being logged, than genuinely due.
 */
export type PurchaseTiming = "now" | "soon" | "later" | "lapsed";

/**
 * "stock" is a thing that gets used up (it has been bought by the kilo, litre
 * or piece). "payment" is money handed over on a steady cycle with nothing
 * measured: a salary, a bill, the monthly medicines.
 */
export type RhythmKind = "stock" | "payment";

export interface PurchaseRhythmEvent {
  date: string;
  /** All rows for this item on this purchase day, added together. */
  amount: number;
  quantity: number | null;
  unit: string | null;
  /** Null only for the item's first recorded purchase. */
  daysSincePrevious: number | null;
  /** Other things logged on the same day, biggest-spend first. */
  otherItems: string[];
}

export interface PurchaseLearningItem {
  key: string;
  name: string;
  category: string;
  lastBoughtOn: string;
  daysSinceLast: number;
  purchaseCount: 1;
  history: PurchaseRhythmEvent[];
  historyTruncated: false;
}

/**
 * A household item's observed buy-again rhythm. This is deliberately based
 * on purchase dates rather than spend: the useful question is when the next
 * potato bag or gas cylinder may be needed, not whether it cost more.
 */
export interface PurchaseRhythm {
  key: string;
  name: string;
  category: string;
  kind: RhythmKind;
  /** Median of the most recent gaps between distinct purchase days. */
  typicalDays: number;
  /** The most recent observed gap, useful beside the longer-term typical. */
  lastGapDays: number;
  /** Smallest and largest gaps among the recent intervals used for the estimate. */
  recentMinDays: number;
  recentMaxDays: number;
  lastBoughtOn: string;
  daysSinceLast: number;
  /** Negative means the usual interval has already passed. */
  dueInDays: number;
  /** When the next one is expected: lastBoughtOn plus typicalDays, or the
   *  same date next month for a monthly payment. */
  nextDueOn: string;
  /** A payment that follows the calendar month, like a salary. */
  monthly: boolean;
  timing: PurchaseTiming;
  /** Progress through the usual interval, capped at 100 for display. */
  cycleProgressPct: number;
  purchaseCount: number;
  intervalCount: number;
  /** Median amount bought on a purchase day, when quantities use one unit. */
  typicalQuantity: number | null;
  unit: string | null;
  /** Median spend on a purchase day, ignoring days with no price written. */
  typicalAmount: number;
  /** Newest first, capped for a useful mobile detail sheet. */
  history: PurchaseRhythmEvent[];
  historyTruncated: boolean;
}

/** What one category (roughly, one shop) will probably need soon. */
export interface ShoppingGroup {
  category: string;
  /** Due now or soon, most pressing first. */
  items: PurchaseRhythm[];
  /** The items' usual spend added up: a rough cost for the trip. */
  estimatedAmount: number;
}

/** Regular payments that fall due on the same day: the cash one date needs. */
export interface PaymentRound {
  /** The shared due date, or null for the payments not made for a while. */
  dueOn: string | null;
  timing: PurchaseTiming;
  total: number;
  /** Biggest first. */
  payments: PurchaseRhythm[];
}

/** Everything known about how long one category's things last. */
export interface LastingGroup {
  category: string;
  /** Items with a measured interval, regulars first, lapsed ones last. */
  rhythms: PurchaseRhythm[];
  /** Bought once so far; the next purchase reveals how long they last. */
  learningItems: PurchaseLearningItem[];
}

/** The Need again tab, already arranged. See buildPurchasePatterns. */
export interface HouseholdNeeds {
  /** Stock due now or soon, one group per category, costliest trip first. */
  shopping: ShoppingGroup[];
  /** When nothing is due yet, the next stock item that will be. */
  nextUp: PurchaseRhythm | null;
  /** Regular unmeasured payments (staff, bills) by due date, soonest first,
   *  with the ones not made for a while last. */
  paymentRounds: PaymentRound[];
  /** Every current payment's usual amount added up: a full cycle of them. */
  paymentsTotal: number;
  /** Stock by category, in the catalogue's own category order. */
  lasting: LastingGroup[];
}

export interface MonthInsight {
  month: string;
  total: number;
  entryCount: number;
  daysWithEntries: number;
  daysInMonth: number;
  /** Days of the month that have happened — the whole month once it is past. */
  daysElapsed: number;
  isCurrentMonth: boolean;
  avgPerDay: number;
  /** Run rate for the month in progress; null for a finished month, and for
   *  the first couple of days when a run rate would be noise. */
  projectedTotal: number | null;
  /** Against the previous month. Null when there is no previous month with
   *  any data to compare against. */
  deltaAmount: number | null;
  deltaPct: number | null;
  longestGapDays: number;
  /** What this month's money actually went on, biggest first. */
  topItems: TopItem[];
  missingRecurring: RecurringGap[];
  priceMoves: PriceMove[];
}

export interface CategorySeries {
  category: string;
  amounts: number[];
  /** Change against the previous month, per month. */
  deltaPcts: (number | null)[];
}

export interface ItemSeries {
  key: string;
  name: string;
  category: string;
  /** Null when the item has never been logged with a unit, or has been logged
   *  in more than one — see `mixedUnits`. */
  unit: string | null;
  mixedUnits: boolean;
  amounts: number[];
  quantities: (number | null)[];
  /** Rupees per `unit`, from priced rows only. */
  rates: (number | null)[];
  /** The spend and quantity a rate may be derived from: rows carrying both a
   *  price and a quantity. Blending a rate across months must divide these,
   *  never the full `amounts` and `quantities`. */
  pricedAmounts: number[];
  pricedQuantities: number[];
  entries: number[];
}

export interface ConsumptionSeries {
  category: string;
  unit: string;
  quantities: number[];
  /** Spend behind those quantities, so groups in different units can be
   *  ranked against each other. */
  amounts: number[];
  deltaPcts: (number | null)[];
}

export type ConsumptionMeasure = "quantity" | "rate" | "amount";

export interface ConsumptionTableRow {
  key: string;
  name: string;
  /** One entry per month; null means nothing bought that month. */
  values: (number | null)[];
  /** Largest value in this row, for scaling its own shading. */
  peak: number;
  /** Across the whole window. For a rate this is blended, not averaged. */
  total: number | null;
}

export interface MeasurableCategory {
  category: string;
  unit: string;
  itemCount: number;
  spend: number;
  /** Share of the category's measurable items that use `unit`. A table of a
   *  category near 1 tells the whole story; one near 0 mostly omits it. */
  coherence: number;
}

export interface ConsumptionTable {
  category: string;
  /** Every row in the table is in this unit; see lib/consumption-table.ts. */
  unit: string;
  measure: ConsumptionMeasure;
  rows: ConsumptionTableRow[];
  totalRow: ConsumptionTableRow | null;
  /** Items in the category measured in some other unit, named so they are
   *  visibly set aside rather than silently missing. */
  otherUnits: { name: string; unit: string }[];
}

export interface ExpenseAnalytics {
  months: MonthInsight[];
  categories: CategorySeries[];
  /** Empty below a user-level session, like `ExpenseMonthData.expenses`. */
  items: ItemSeries[];
  consumption: ConsumptionSeries[];
  /** Empty below a user-level session because names and dates are sensitive. */
  needs: HouseholdNeeds;
  unlocked: boolean;
}

export interface ExpenseMonthData {
  month: string;
  total: number;
  categoryTotals: CategoryTotal[];
  // Empty (with unlocked: false) unless the caller has at least a
  // user-level session — see app/api/expenses/route.ts.
  expenses: Expense[];
  unlocked: boolean;
}
