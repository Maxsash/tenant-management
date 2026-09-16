import { addMonths, daysBetween, isValidDate, monthRange } from "@/lib/date";
import { median, percentOf, round, sum } from "@/lib/numbers";
import { getOnTimeDeadline } from "@/lib/payment-status";
import { getPaymentMonth, getRentMonth } from "@/lib/rent";
import {
  buildRentLedger,
  HISTORY_START,
  type RentLedgerEntry,
} from "@/lib/rent-ledger";
import type { Payment } from "@/types/payment";
import type {
  FiscalYearTotal,
  RentAhead,
  RentAlert,
  RentAnalytics,
  RentBankTotal,
  RentChange,
  RentDeposits,
  RentMonthInsight,
  RentMonthTenant,
  RentState,
  RentSummary,
  RentTrend,
  TenantInsight,
} from "@/types/rent-analytics";
import type { Tenant } from "@/types/tenant";

/**
 * Tuning for the behaviour checks. Exported, like the expense analytics
 * constants, because each is a judgement call about what is worth mentioning
 * rather than a fact.
 */

/** "Paying later lately" compares the last few payments against the ones
 *  before them, over a fixed lookback so the answer doesn't change with the
 *  window picked on screen. */
export const TREND_LOOKBACK_MONTHS = 12;
export const TREND_RECENT_PAYMENTS = 3;
/** Earlier payments needed before a comparison means anything. */
export const TREND_MIN_EARLIER_PAYMENTS = 3;
/** A shift smaller than this is ordinary wobble — the 5th one month, the 8th
 *  the next. */
export const TREND_MIN_SHIFT_DAYS = 5;

/** Late this many months running, from someone who used to pay on time, is
 *  a change worth hearing about. Someone who has always paid late is not news
 *  every month — their tenant card already says so. */
export const LATE_STREAK_MIN_MONTHS = 2;

/** An increase this close is worth telling the tenant about now. Counted from
 *  the month in progress, so 2 covers this month and the next two. */
export const INCREASE_NOTICE_MONTHS = 2;

/** How far ahead rent is projected from the current schedule. */
export const PROJECTION_MONTHS = 12;
export const MAX_FISCAL_YEARS = 3;

const STATE_URGENCY: Record<RentState, number> = {
  overdue: 0,
  due: 1,
  late: 2,
  on_time: 3,
};

/** The ledger's paid/late/pending, with pending split by whether it is late
 *  yet. */
export function rentState(entry: RentLedgerEntry, today: string): RentState {
  if (entry.status === "paid") return "on_time";
  if (entry.status === "late") return "late";
  return today > entry.due_by ? "overdue" : "due";
}

/**
 * Which day rent arrived, counted from the 1st of the month it was due in:
 * August's rent paid on 6 September is day 6. Paid a week into October it is
 * day 37, and paid in advance it is zero or below.
 */
export function payDay(entry: RentLedgerEntry): number | null {
  const paidOn = entry.paid_on?.slice(0, 10);
  if (!isValidDate(paidOn)) return null;

  return daysBetween(`${getPaymentMonth(entry.rent_month)}-01`, paidOn) + 1;
}

function daysLate(
  entry: RentLedgerEntry,
  state: RentState,
  today: string
): number | null {
  if (state === "late" && entry.paid_on) {
    return daysBetween(entry.due_by, entry.paid_on.slice(0, 10));
  }
  if (state === "overdue") return daysBetween(entry.due_by, today);
  return null;
}

function paid(entries: RentLedgerEntry[]): RentLedgerEntry[] {
  return entries.filter((e) => e.status === "paid" || e.status === "late");
}

/** "Usually paid by the Nth" — a half day rounds later, since "by" should
 *  not promise earlier than the payments did. */
function typicalPayDay(entries: RentLedgerEntry[]): number | null {
  const days = entries
    .map(payDay)
    .filter((day): day is number => day !== null);

  return days.length > 0 ? Math.ceil(median(days)) : null;
}

/** "2026-27" for any rent month from April 2026 to March 2027. */
export function fiscalYearOf(month: string): { label: string; start: string } {
  const year = Number(month.slice(0, 4));
  const startYear = Number(month.slice(5, 7)) >= 4 ? year : year - 1;

  return {
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
    start: `${startYear}-04`,
  };
}

function fullYearsBetween(from: string, to: string): number {
  const years = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  return to.slice(5, 10) < from.slice(5, 10) ? years - 1 : years;
}

function onTimeStreak(entries: RentLedgerEntry[], today: string): number {
  let streak = 0;

  for (let i = entries.length - 1; i >= 0; i--) {
    const state = rentState(entries[i], today);
    // A month whose deadline hasn't come yet neither extends nor breaks it.
    if (state === "due" && streak === 0) continue;
    if (state !== "on_time") break;
    streak += 1;
  }

  return streak;
}

/**
 * How many months running someone has paid late, counted back from the most
 * recent — but only when that is new for them: in the months before the
 * streak they paid on time at least half the time. Zero otherwise.
 */
export function newLateStreak(entries: RentLedgerEntry[], today: string): number {
  const states = entries.map((entry) => rentState(entry, today));
  // A month whose deadline hasn't come yet neither extends nor breaks it.
  if (states.at(-1) === "due") states.pop();

  let streak = 0;
  while (streak < states.length && states[states.length - 1 - streak] === "late") {
    streak += 1;
  }
  if (streak < LATE_STREAK_MIN_MONTHS) return 0;

  const before = states.slice(0, states.length - streak);
  const onTimeBefore = before.filter((state) => state === "on_time").length;

  return before.length >= TREND_MIN_EARLIER_PAYMENTS && onTimeBefore * 2 >= before.length
    ? streak
    : 0;
}

/**
 * Whether someone has started paying noticeably later (or earlier) than they
 * used to: the median of their last few payments against the median of the
 * ones before, within the lookback.
 */
export function payTrend(
  paidEntries: RentLedgerEntry[]
): { trend: RentTrend | null; usualDay: number | null; recentDay: number | null } {
  const recent = paidEntries.slice(-TREND_RECENT_PAYMENTS);
  const earlier = paidEntries.slice(0, -TREND_RECENT_PAYMENTS);
  const recentDay = typicalPayDay(recent);
  const usualDay = typicalPayDay(earlier);

  if (
    recent.length < TREND_RECENT_PAYMENTS ||
    earlier.length < TREND_MIN_EARLIER_PAYMENTS ||
    recentDay === null ||
    usualDay === null
  ) {
    return { trend: null, usualDay, recentDay };
  }

  const shift = recentDay - usualDay;
  const trend =
    shift >= TREND_MIN_SHIFT_DAYS
      ? "later"
      : shift <= -TREND_MIN_SHIFT_DAYS
        ? "earlier"
        : null;

  return { trend, usualDay, recentDay };
}

export interface OverdueTotal {
  amount: number;
  tenants: number;
}

/**
 * Rent past its deadline and not marked paid, split by whether the tenant is
 * still here (`stillHere` holds their ids). What former tenants left unpaid is
 * kept apart because it is as often settled against a deposit, or a payment
 * never recorded, as money still to chase.
 */
export function overdueTotals(
  ledger: RentLedgerEntry[],
  today: string,
  stillHere: Set<string>
): { current: OverdueTotal; former: OverdueTotal } {
  const overdue = ledger.filter((e) => rentState(e, today) === "overdue");
  const total = (here: boolean): OverdueTotal => {
    const entries = overdue.filter((e) => stillHere.has(e.tenant.id) === here);
    return {
      amount: sum(entries.map((e) => e.amount)),
      tenants: new Set(entries.map((e) => e.tenant.id)).size,
    };
  };

  return { current: total(true), former: total(false) };
}

function describeMonth(
  month: string,
  entries: RentLedgerEntry[],
  previous: RentLedgerEntry[] | null,
  today: string,
  unlocked: boolean
): RentMonthInsight {
  const rows = entries.map((entry) => ({ entry, state: rentState(entry, today) }));
  const inState = (state: RentState) => rows.filter((r) => r.state === state);
  const amountOf = (list: typeof rows) => sum(list.map((r) => r.entry.amount));

  const onTime = inState("on_time");
  const late = inState("late");
  const overdue = inState("overdue");
  const due = inState("due");

  const dueBy = getOnTimeDeadline(month) as string;
  const isOpen = today <= dueBy;
  const expected = amountOf(rows);
  const collected = amountOf(onTime) + amountOf(late);
  const settled = onTime.length + late.length + overdue.length;
  const previousExpected = previous ? sum(previous.map((e) => e.amount)) : 0;

  return {
    month,
    dueBy,
    isOpen,
    tenantCount: rows.length,
    expected,
    collected,
    collectedPct: percentOf(collected, expected),
    onTimeCount: onTime.length,
    lateCount: late.length,
    overdueCount: overdue.length,
    dueCount: due.length,
    onTimeAmount: amountOf(onTime),
    lateAmount: amountOf(late),
    overdueAmount: amountOf(overdue),
    dueAmount: amountOf(due),
    onTimePct: isOpen ? null : percentOf(onTime.length, settled),
    medianPayDay: typicalPayDay(entries),
    expectedDeltaPct:
      previous && previousExpected > 0
        ? round(((expected - previousExpected) / previousExpected) * 100, 1)
        : null,
    tenants: unlocked ? monthTenants(rows, today) : [],
    byBank: unlocked ? bankTotals(rows) : [],
    changes: unlocked ? monthChanges(month, entries, previous ?? []) : null,
  };
}

function monthTenants(
  rows: { entry: RentLedgerEntry; state: RentState }[],
  today: string
): RentMonthTenant[] {
  return rows
    .map(({ entry, state }) => ({
      id: entry.tenant.id,
      name: entry.tenant.name,
      amount: entry.amount,
      state,
      paidOn: entry.paid_on,
      daysLate: daysLate(entry, state, today),
    }))
    .sort(
      (a, b) =>
        STATE_URGENCY[a.state] - STATE_URGENCY[b.state] || b.amount - a.amount
    );
}

function bankTotals(
  rows: { entry: RentLedgerEntry; state: RentState }[]
): RentBankTotal[] {
  const totals = new Map<string | null, RentBankTotal>();

  for (const { entry, state } of rows) {
    const bank = entry.tenant.bank?.trim() || null;
    const total = totals.get(bank) ?? {
      bank,
      expected: 0,
      collected: 0,
      collectedPct: null,
    };
    total.expected += entry.amount;
    if (state === "on_time" || state === "late") total.collected += entry.amount;
    totals.set(bank, total);
  }

  return [...totals.values()]
    .map((total) => ({
      ...total,
      collectedPct: percentOf(total.collected, total.expected),
    }))
    .sort((a, b) => b.expected - a.expected);
}

function monthChanges(
  month: string,
  entries: RentLedgerEntry[],
  previous: RentLedgerEntry[]
) {
  const before = new Map(previous.map((e) => [e.tenant.id, e.amount]));
  const brief = (e: RentLedgerEntry) => ({
    id: e.tenant.id,
    name: e.tenant.name,
    amount: e.amount,
  });

  return {
    movedIn: entries
      .filter((e) => e.tenant.tenant_since?.slice(0, 7) === month)
      .map(brief),
    movedOut: entries
      .filter((e) => e.tenant.vacated_on?.slice(0, 7) === month)
      .map(brief),
    rentChanges: entries
      .filter((e) => before.has(e.tenant.id) && before.get(e.tenant.id) !== e.amount)
      .map((e) => ({
        id: e.tenant.id,
        name: e.tenant.name,
        from: before.get(e.tenant.id) as number,
        to: e.amount,
        change: e.amount - (before.get(e.tenant.id) as number),
      })),
  };
}

/** Every change in a tenant's rent over the projection, against the month
 *  before it — including the step from the latest due month into the first
 *  projected one. */
function upcomingIncreases(
  ahead: RentLedgerEntry[],
  latest: RentLedgerEntry[]
): (RentChange & { month: string })[] {
  const lastAmount = new Map(latest.map((e) => [e.tenant.id, e.amount]));
  const changes: (RentChange & { month: string })[] = [];

  for (const entry of ahead) {
    const before = lastAmount.get(entry.tenant.id);
    if (before !== undefined && before !== entry.amount) {
      changes.push({
        id: entry.tenant.id,
        name: entry.tenant.name,
        month: entry.rent_month,
        from: before,
        to: entry.amount,
        change: entry.amount - before,
      });
    }
    lastAmount.set(entry.tenant.id, entry.amount);
  }

  return changes.sort((a, b) => a.month.localeCompare(b.month));
}

export interface BuildRentAnalyticsOptions {
  /** "YYYY-MM-DD" — injected so what counts as overdue is testable. */
  today: string;
  /** How many rent months the window shows, ending at the latest due one. */
  windowMonths: number;
  /** Anything naming a tenant needs a user-level session, like a tenant's
   *  payment history does. */
  unlocked: boolean;
}

/**
 * Everything the rent insights screen renders, from the tenants and payments
 * tables. Amounts and statuses come from lib/rent-ledger.ts and nowhere else.
 *
 * Month figures are built over the whole history so the change at the left
 * edge of the window still compares against the real previous month, then
 * sliced to the window. Money owed is counted across the whole history
 * regardless of window: a month that fell off the left edge is still owed.
 */
export function buildRentAnalytics(
  tenants: Tenant[],
  payments: Payment[],
  { today, windowMonths, unlocked }: BuildRentAnalyticsOptions
): RentAnalytics {
  const empty: RentAnalytics = {
    months: [],
    summary: null,
    fiscalYears: [],
    ahead: null,
    alerts: [],
    currentTenants: [],
    formerTenants: [],
    deposits: null,
    historyFrom: HISTORY_START,
    unlocked,
  };

  if (!isValidDate(today)) return empty;

  // Rent for the calendar month in progress isn't payable until next month,
  // so the newest month that has come due is the one before it.
  const currentMonth = today.slice(0, 7);
  const latestMonth = getRentMonth(currentMonth);
  const allMonths = monthRange(HISTORY_START, latestMonth);
  if (allMonths.length === 0) return empty;

  const ledger = buildRentLedger(tenants, payments, {
    from: HISTORY_START,
    to: latestMonth,
  });
  const aheadLedger = buildRentLedger(tenants, payments, {
    from: currentMonth,
    to: addMonths(currentMonth, PROJECTION_MONTHS - 1),
  });

  const windowStart = Math.max(0, allMonths.length - Math.max(1, windowMonths));
  const windowMonthList = allMonths.slice(windowStart);

  const byMonth = new Map<string, RentLedgerEntry[]>(allMonths.map((m) => [m, []]));
  for (const entry of ledger) byMonth.get(entry.rent_month)?.push(entry);

  const months = windowMonthList.map((month) => {
    const i = allMonths.indexOf(month);
    return describeMonth(
      month,
      byMonth.get(month) ?? [],
      i > 0 ? (byMonth.get(allMonths[i - 1]) ?? []) : null,
      today,
      unlocked
    );
  });

  // ---- now ----------------------------------------------------------------
  const inProgress = aheadLedger.filter((e) => e.rent_month === currentMonth);
  const monthlyRent = sum(inProgress.map((e) => e.amount));
  const stillHere = new Set(aheadLedger.map((e) => e.tenant.id));
  const overdue = overdueTotals(ledger, today, stillHere);

  const windowSettled = sum(
    months.filter((m) => !m.isOpen).map((m) => m.tenantCount)
  );
  const windowOnTime = sum(
    months.filter((m) => !m.isOpen).map((m) => m.onTimeCount)
  );
  const windowExpected = sum(months.map((m) => m.expected));
  const windowCollected = sum(months.map((m) => m.collected));

  const summary: RentSummary = {
    latestMonth,
    currentMonth,
    monthlyRent,
    currentTenants: new Set(inProgress.map((e) => e.tenant.id)).size,
    windowExpected,
    windowCollected,
    windowCollectedPct: percentOf(windowCollected, windowExpected),
    windowOnTimePct: percentOf(windowOnTime, windowSettled),
    overdueAmount: overdue.current.amount,
    overdueTenants: overdue.current.tenants,
    formerOwedAmount: overdue.former.amount,
    formerOwedTenants: overdue.former.tenants,
  };

  // ---- financial years ----------------------------------------------------
  const fiscalYears: FiscalYearTotal[] = [];
  for (const month of [...allMonths].reverse()) {
    const { label, start } = fiscalYearOf(month);
    let year = fiscalYears.find((y) => y.label === label);
    if (!year) {
      if (fiscalYears.length === MAX_FISCAL_YEARS) break;
      year = {
        label,
        from: month,
        to: month,
        expected: 0,
        collected: 0,
        collectedPct: null,
        isCurrent: label === fiscalYearOf(latestMonth).label,
        startsLate: false,
      };
      fiscalYears.push(year);
    }

    const entries = byMonth.get(month) ?? [];
    year.from = month;
    year.startsLate = month !== start;
    year.expected += sum(entries.map((e) => e.amount));
    year.collected += sum(
      entries
        .filter((e) => e.status === "paid" || e.status === "late")
        .map((e) => e.amount)
    );
  }
  for (const year of fiscalYears) {
    year.collectedPct = percentOf(year.collected, year.expected);
  }

  // ---- ahead --------------------------------------------------------------
  const projection = monthRange(
    currentMonth,
    addMonths(currentMonth, PROJECTION_MONTHS - 1)
  ).map((month) => ({
    month,
    expected: sum(
      aheadLedger.filter((e) => e.rent_month === month).map((e) => e.amount)
    ),
  }));
  const increases = upcomingIncreases(aheadLedger, byMonth.get(latestMonth) ?? []);

  const ahead: RentAhead = {
    months: projection,
    total: sum(projection.map((m) => m.expected)),
    increases: unlocked ? increases : [],
  };

  const base = { ...empty, months, summary, fiscalYears, ahead };
  if (!unlocked) return base;

  // ---- per tenant ---------------------------------------------------------
  const trendFrom = addMonths(latestMonth, -(TREND_LOOKBACK_MONTHS - 1));
  const windowFrom = windowMonthList[0];
  const insights: TenantInsight[] = [];
  // Working facts about a tenant that shape the lists below but aren't sent.
  const isCurrent = new Set<string>();
  const lateStreaks = new Map<string, number>();
  const trends = new Map<string, ReturnType<typeof payTrend>>();

  for (const tenant of tenants) {
    const entries = ledger.filter((e) => e.tenant.id === tenant.id);
    const future = aheadLedger.filter((e) => e.tenant.id === tenant.id);
    // Never owed rent in the history or the projection — an inactive row with
    // no move-out date, which there is no honest way to place.
    if (entries.length === 0 && future.length === 0) continue;

    const current = stillHere.has(tenant.id);
    if (current) isCurrent.add(tenant.id);
    const lookback = entries.filter((e) => e.rent_month >= trendFrom);
    const payTiming = payTrend(paid(lookback));
    lateStreaks.set(tenant.id, newLateStreak(lookback, today));
    trends.set(tenant.id, payTiming);
    const owesThisMonth = future.some((e) => e.rent_month === currentMonth);
    const inWindow = entries.filter((e) => e.rent_month >= windowFrom);
    const windowStates = new Map(
      inWindow.map((e) => [e.rent_month, rentState(e, today)])
    );
    const count = (state: RentState) =>
      [...windowStates.values()].filter((s) => s === state).length;
    const onTimeCount = count("on_time");
    const lateCount = count("late");
    const overdueCount = count("overdue");
    const owedEntries = entries.filter((e) => rentState(e, today) === "overdue");

    const rent = current
      ? (future.find((e) => e.rent_month === currentMonth) ?? future[0]).amount
      : (entries.at(-1)?.amount ?? 0);
    const deposit = Number(tenant.security_deposit) || 0;
    const nextIncrease = increases.find((c) => c.id === tenant.id);

    insights.push({
      id: tenant.id,
      name: tenant.name,
      propertyType: tenant.property_type,
      rent,
      sharePct: owesThisMonth ? percentOf(rent, monthlyRent) : null,
      tenantSince: tenant.tenant_since ?? null,
      yearsWithUs:
        current && isValidDate(tenant.tenant_since?.slice(0, 10))
          ? Math.max(0, fullYearsBetween(tenant.tenant_since as string, today))
          : null,
      movedOutOn: current ? null : (tenant.vacated_on ?? null),
      bank: tenant.bank?.trim() || null,
      deposit,
      depositMonths: rent > 0 ? round(deposit / rent, 1) : null,
      history: windowMonthList.map((m) => windowStates.get(m) ?? null),
      onTimeCount,
      lateCount,
      overdueCount,
      settledCount: onTimeCount + lateCount + overdueCount,
      onTimePct: percentOf(onTimeCount, onTimeCount + lateCount + overdueCount),
      medianPayDay: typicalPayDay(inWindow),
      recentPayDay: payTiming.recentDay,
      trend: payTiming.trend,
      onTimeStreak: onTimeStreak(entries, today),
      collected: sum(paid(entries).map((e) => e.amount)),
      owed: sum(owedEntries.map((e) => e.amount)),
      owedMonths: owedEntries.map((e) => e.rent_month),
      nextIncrease: nextIncrease
        ? {
            month: nextIncrease.month,
            from: nextIncrease.from,
            to: nextIncrease.to,
            change: nextIncrease.change,
          }
        : null,
      firstRentMonth: entries.length === 0 ? future[0].rent_month : null,
    });
  }

  const current = insights
    .filter((t) => isCurrent.has(t.id))
    .sort((a, b) => b.owed - a.owed || b.rent - a.rent);
  const former = insights
    .filter((t) => !isCurrent.has(t.id))
    .sort((a, b) => (b.movedOutOn ?? "").localeCompare(a.movedOutOn ?? ""));

  // ---- deposits -----------------------------------------------------------
  const held = sum(current.map((t) => t.deposit));
  const deposits: RentDeposits = {
    held,
    heldMonths: monthlyRent > 0 ? round(held / monthlyRent, 1) : null,
    withoutDeposit: current.filter((t) => t.deposit <= 0).length,
    current: [...current]
      .sort((a, b) => b.deposit - a.deposit)
      .map((t) => ({
        id: t.id,
        name: t.name,
        deposit: t.deposit,
        rent: t.rent,
        depositMonths: t.depositMonths,
        owed: t.owed,
        owedExceedsDeposit: t.owed > t.deposit,
      })),
    former: former
      .filter((t) => t.deposit > 0 || t.owed > 0)
      .map((t) => ({
        id: t.id,
        name: t.name,
        deposit: t.deposit,
        movedOutOn: t.movedOutOn,
        owed: t.owed,
      })),
  };

  // ---- what needs a look --------------------------------------------------
  const noticeUntil = addMonths(currentMonth, INCREASE_NOTICE_MONTHS);
  const owedBy = (list: TenantInsight[]) =>
    list
      .filter((t) => t.owed > 0)
      .sort((a, b) => b.owed - a.owed)
      .map((t) => ({
        kind: "overdue" as const,
        id: t.id,
        name: t.name,
        amount: t.owed,
        months: t.owedMonths,
        isCurrent: isCurrent.has(t.id),
        exceedsDeposit: t.owed > t.deposit,
      }));

  // What can still be acted on comes first; former tenants' arrears last.
  const alerts: RentAlert[] = [
    ...owedBy(current),
    ...current
      .filter((t) => (lateStreaks.get(t.id) ?? 0) >= LATE_STREAK_MIN_MONTHS)
      .map((t) => ({
        kind: "late_streak" as const,
        id: t.id,
        name: t.name,
        months: lateStreaks.get(t.id) as number,
      })),
    // Someone already flagged for a run of late months doesn't also need
    // telling they pay later than they used to.
    ...current
      .filter(
        (t) =>
          t.trend === "later" &&
          (lateStreaks.get(t.id) ?? 0) < LATE_STREAK_MIN_MONTHS
      )
      .map((t) => ({
        kind: "paying_later" as const,
        id: t.id,
        name: t.name,
        usualDay: trends.get(t.id)?.usualDay as number,
        recentDay: trends.get(t.id)?.recentDay as number,
      })),
    ...increases
      .filter((c) => c.month <= noticeUntil)
      .map((c) => ({ kind: "increase_soon" as const, ...c })),
    ...owedBy(former),
  ];

  return {
    ...base,
    alerts,
    currentTenants: current,
    formerTenants: former,
    deposits,
  };

}
