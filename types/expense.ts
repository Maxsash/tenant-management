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
