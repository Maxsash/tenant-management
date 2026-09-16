/**
 * Shapes behind /tenant/insights. Every `history` array below is index-aligned
 * with `RentAnalytics.months`, so position i is the same rent month throughout.
 *
 * All months are RENT months — "2026-08" is rent for August, paid in September.
 */

/**
 * What became of one month's rent for one tenant. `due` is unpaid but not late
 * yet (the on-time deadline is still ahead); `overdue` is unpaid past it.
 */
export type RentState = "on_time" | "late" | "overdue" | "due";

export interface RentMonthTenant {
  id: string;
  name: string;
  amount: number;
  state: RentState;
  paidOn: string | null;
  /** Days past the on-time deadline: when it was paid for `late`, as of today
   *  for `overdue`. Null otherwise. */
  daysLate: number | null;
}

export interface RentBankTotal {
  /** Null when the tenant has no bank recorded. */
  bank: string | null;
  expected: number;
  collected: number;
  collectedPct: number | null;
}

export interface RentChange {
  id: string;
  name: string;
  from: number;
  to: number;
  /** `to - from`: positive for an increase. */
  change: number;
}

export interface RentMonthChanges {
  movedIn: { id: string; name: string; amount: number }[];
  movedOut: { id: string; name: string; amount: number }[];
  rentChanges: RentChange[];
}

export interface RentMonthInsight {
  month: string;
  /** Last day this month's rent counts as on time. */
  dueBy: string;
  /** True until `dueBy` has passed — unpaid rent is not late yet. */
  isOpen: boolean;
  tenantCount: number;
  expected: number;
  collected: number;
  collectedPct: number | null;
  onTimeCount: number;
  lateCount: number;
  overdueCount: number;
  dueCount: number;
  onTimeAmount: number;
  lateAmount: number;
  overdueAmount: number;
  dueAmount: number;
  /** Share paid on time, of the tenants whose outcome is settled. Null while
   *  the month is open, when a rate would only describe the early payers. */
  onTimePct: number | null;
  /** Median day rent arrived, counted from the 1st of the month it was paid
   *  in — 6 means "the 6th". Null when nothing was paid. */
  medianPayDay: number | null;
  /** The month's total rent against the month before. */
  expectedDeltaPct: number | null;
  /** Below here: empty or null without a user-level session. Most urgent
   *  first — overdue, then not yet due, late, on time. */
  tenants: RentMonthTenant[];
  byBank: RentBankTotal[];
  changes: RentMonthChanges | null;
}

export type RentTrend = "later" | "earlier";

export interface TenantInsight {
  id: string;
  name: string;
  propertyType: string;
  /** Rent for the month in progress for a current tenant; the last rent they
   *  owed for a former one. */
  rent: number;
  /** Of the current monthly rent, for current tenants only. */
  sharePct: number | null;
  tenantSince: string | null;
  yearsWithUs: number | null;
  movedOutOn: string | null;
  bank: string | null;
  deposit: number;
  /** Deposit as months of rent. Null when there is no rent to measure by. */
  depositMonths: number | null;
  /** One per window month; null where they were not a tenant that month. */
  history: (RentState | null)[];
  onTimeCount: number;
  lateCount: number;
  overdueCount: number;
  /** Window months whose outcome is known: the three counts above together. */
  settledCount: number;
  onTimePct: number | null;
  medianPayDay: number | null;
  /** Median pay day over the last few paid months, for the trend below. */
  recentPayDay: number | null;
  trend: RentTrend | null;
  /** Consecutive most recent months paid on time. */
  onTimeStreak: number;
  /** Since HISTORY_START, not just the window. */
  collected: number;
  owed: number;
  owedMonths: string[];
  nextIncrease: (Omit<RentChange, "id" | "name"> & { month: string }) | null;
  /** The first month rent is owed, for someone who has not owed any yet. */
  firstRentMonth: string | null;
}

export type RentAlert =
  | {
      kind: "overdue";
      id: string;
      name: string;
      amount: number;
      months: string[];
      isCurrent: boolean;
      exceedsDeposit: boolean;
    }
  | { kind: "late_streak"; id: string; name: string; months: number }
  | {
      kind: "paying_later";
      id: string;
      name: string;
      usualDay: number;
      recentDay: number;
    }
  | ({ kind: "increase_soon"; month: string } & RentChange);

export interface FiscalYearTotal {
  /** "2026-27" — April to March, by the month rent is for. */
  label: string;
  from: string;
  to: string;
  expected: number;
  collected: number;
  collectedPct: number | null;
  isCurrent: boolean;
  /** True when history starts partway through the year, so the total is not
   *  a whole year's rent. */
  startsLate: boolean;
}

export interface DepositRow {
  id: string;
  name: string;
  deposit: number;
  rent: number;
  depositMonths: number | null;
  owed: number;
  owedExceedsDeposit: boolean;
}

export interface FormerDepositRow {
  id: string;
  name: string;
  deposit: number;
  movedOutOn: string | null;
  owed: number;
}

export interface RentDeposits {
  held: number;
  heldMonths: number | null;
  withoutDeposit: number;
  current: DepositRow[];
  former: FormerDepositRow[];
}

export interface RentSummary {
  /** The newest rent month that has come due (its payment month has begun). */
  latestMonth: string;
  /** The month in progress, whose rent is paid next month. */
  currentMonth: string;
  /** Total rent for `currentMonth`. */
  monthlyRent: number;
  currentTenants: number;
  windowExpected: number;
  windowCollected: number;
  windowCollectedPct: number | null;
  windowOnTimePct: number | null;
  /** Rent past its deadline and not marked paid, across all history, from
   *  tenants who are still here. */
  overdueAmount: number;
  overdueTenants: number;
  /** The same for tenants who have moved out — kept apart, since it is as
   *  often settled against a deposit, or a payment never recorded, as money
   *  still to chase. */
  formerOwedAmount: number;
  formerOwedTenants: number;
}

export interface RentAhead {
  months: { month: string; expected: number }[];
  total: number;
  /** Empty without a user-level session. */
  increases: (RentChange & { month: string })[];
}

export interface RentAnalytics {
  months: RentMonthInsight[];
  summary: RentSummary | null;
  fiscalYears: FiscalYearTotal[];
  ahead: RentAhead | null;
  /** Below here: empty or null without a user-level session. */
  alerts: RentAlert[];
  currentTenants: TenantInsight[];
  formerTenants: TenantInsight[];
  deposits: RentDeposits | null;
  historyFrom: string;
  unlocked: boolean;
}
