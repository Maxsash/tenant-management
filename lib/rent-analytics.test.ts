import { describe, expect, it } from "vitest";
import { makeTenant } from "@/test/fixtures/tenants";
import { makePayment } from "@/test/fixtures/payments";
import { monthRange } from "@/lib/date";
import { getPaymentMonth } from "@/lib/rent";
import type { RentLedgerEntry } from "@/lib/rent-ledger";
import type { Payment } from "@/types/payment";
import type { Tenant } from "@/types/tenant";
import {
  buildRentAnalytics,
  fiscalYearOf,
  newLateStreak,
  payDay,
  payTrend,
  TREND_MIN_SHIFT_DAYS,
} from "./rent-analytics";

// Mid-September: August's rent has come due (by 7 September) and is past its
// deadline; September's is not payable until October.
const TODAY = "2026-09-16";

function build(
  tenants: Tenant[],
  payments: Payment[],
  { today = TODAY, windowMonths = 12, unlocked = true } = {}
) {
  return buildRentAnalytics(tenants, payments, { today, windowMonths, unlocked });
}

/** Rent for `rentMonth` paid on the given day of the month after it. */
function paidFor(tenantId: string, rentMonth: string, day: number): Payment {
  const month = getPaymentMonth(rentMonth);
  return makePayment({
    id: `${tenantId}-${rentMonth}`,
    tenant_id: tenantId,
    month,
    paid_on: `${month}-${String(day).padStart(2, "0")}`,
  });
}

function paidRange(tenantId: string, from: string, to: string, day: number) {
  return monthRange(from, to).map((m) => paidFor(tenantId, m, day));
}

function entry(overrides: Partial<RentLedgerEntry>): RentLedgerEntry {
  return {
    tenant: makeTenant(),
    rent_month: "2026-08",
    amount: 10000,
    status: "paid",
    paid_on: "2026-09-05",
    due_by: "2026-09-07",
    ...overrides,
  };
}

describe("payDay", () => {
  it("counts from the 1st of the month the rent was paid in", () => {
    expect(payDay(entry({ paid_on: "2026-09-06" }))).toBe(6);
    expect(payDay(entry({ paid_on: "2026-10-02" }))).toBe(32);
    expect(payDay(entry({ paid_on: "2026-08-31" }))).toBe(0);
  });

  it("is null when nothing was paid", () => {
    expect(payDay(entry({ status: "pending", paid_on: null }))).toBeNull();
  });
});

describe("fiscalYearOf", () => {
  it("runs April to March", () => {
    expect(fiscalYearOf("2026-04")).toEqual({ label: "2026-27", start: "2026-04" });
    expect(fiscalYearOf("2027-03")).toEqual({ label: "2026-27", start: "2026-04" });
    expect(fiscalYearOf("2026-03").label).toBe("2025-26");
  });

  it("pads the second year across a century", () => {
    expect(fiscalYearOf("2099-05").label).toBe("2099-00");
  });
});

describe("payTrend", () => {
  const onDay = (days: number[]) =>
    days.map((day, i) =>
      entry({ rent_month: `2026-0${i + 1}`, paid_on: `2026-0${i + 2}-${String(day).padStart(2, "0")}` })
    );

  it("says later when the last few payments moved enough days later", () => {
    const result = payTrend(onDay([2, 2, 2, 2 + TREND_MIN_SHIFT_DAYS, 2 + TREND_MIN_SHIFT_DAYS, 2 + TREND_MIN_SHIFT_DAYS]));

    expect(result).toEqual({ trend: "later", usualDay: 2, recentDay: 2 + TREND_MIN_SHIFT_DAYS });
  });

  it("says earlier for the opposite move", () => {
    expect(payTrend(onDay([9, 9, 9, 2, 2, 2])).trend).toBe("earlier");
  });

  it("stays quiet for ordinary wobble", () => {
    expect(payTrend(onDay([5, 6, 5, 8, 7, 8])).trend).toBeNull();
  });

  it("stays quiet without enough earlier payments to compare against", () => {
    expect(payTrend(onDay([1, 1, 9, 9, 9])).trend).toBeNull();
  });
});

describe("newLateStreak", () => {
  const states = (list: ("paid" | "late" | "pending")[]) =>
    list.map((status, i) =>
      entry({
        rent_month: `2026-0${i + 1}`,
        due_by: `2026-0${i + 2}-07`,
        status,
        paid_on: status === "pending" ? null : `2026-0${i + 2}-05`,
      })
    );

  it("counts a run of late months from someone who used to pay on time", () => {
    expect(newLateStreak(states(["paid", "paid", "paid", "late", "late"]), TODAY)).toBe(2);
  });

  it("is zero for someone who has always paid late", () => {
    expect(newLateStreak(states(["late", "late", "late", "late", "late"]), TODAY)).toBe(0);
  });

  it("is zero for a single late month", () => {
    expect(newLateStreak(states(["paid", "paid", "paid", "paid", "late"]), TODAY)).toBe(0);
  });

  it("ignores a final month that isn't due yet", () => {
    const list = states(["paid", "paid", "paid", "late", "late", "pending"]);

    expect(newLateStreak(list, "2026-07-03")).toBe(2);
  });
});

describe("buildRentAnalytics", () => {
  it("is empty for a malformed today", () => {
    const result = build([makeTenant()], [], { today: "soon" });

    expect(result.months).toEqual([]);
    expect(result.summary).toBeNull();
  });

  describe("months", () => {
    it("ends at the newest rent month that has come due, and honours the window", () => {
      const result = build([makeTenant()], [], { windowMonths: 3 });

      expect(result.months.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08"]);
    });

    it("never reaches back before the start of history", () => {
      const result = build([makeTenant()], [], { today: "2024-02-10", windowMonths: 12 });

      expect(result.months.map((m) => m.month)).toEqual(["2023-12", "2024-01"]);
    });

    it("splits a closed month into on time, late and overdue", () => {
      const tenants = [
        makeTenant({ id: "a", base_rent: 10000 }),
        makeTenant({ id: "b", base_rent: 6000 }),
        makeTenant({ id: "c", base_rent: 4000 }),
      ];
      const payments = [paidFor("a", "2026-08", 5), paidFor("b", "2026-08", 12)];

      const august = build(tenants, payments).months.at(-1)!;

      expect(august).toMatchObject({
        month: "2026-08",
        dueBy: "2026-09-07",
        isOpen: false,
        tenantCount: 3,
        expected: 20000,
        collected: 16000,
        collectedPct: 80,
        onTimeCount: 1,
        lateCount: 1,
        overdueCount: 1,
        dueCount: 0,
        onTimeAmount: 10000,
        lateAmount: 6000,
        overdueAmount: 4000,
        onTimePct: 33,
        medianPayDay: 9,
      });
    });

    it("treats unpaid rent before the deadline as due, not overdue, and holds back the on-time rate", () => {
      const tenants = [makeTenant({ id: "a" }), makeTenant({ id: "b" })];
      const payments = [paidFor("a", "2026-08", 2)];

      const august = build(tenants, payments, { today: "2026-09-04" }).months.at(-1)!;

      expect(august).toMatchObject({ isOpen: true, dueCount: 1, overdueCount: 0, onTimePct: null });
    });

    it("compares the first window month against the real month before it", () => {
      const tenants = [
        makeTenant({ id: "a", base_rent: 10000 }),
        makeTenant({ id: "b", base_rent: 10000, active: false, vacated_on: "2026-06-30" }),
      ];

      const [july] = build(tenants, [], { windowMonths: 2 }).months;

      expect(july.month).toBe("2026-07");
      expect(july.expectedDeltaPct).toBe(-50);
    });

    it("lists who paid when, most urgent first, with days past the deadline", () => {
      const tenants = [
        makeTenant({ id: "ontime", name: "On time" }),
        makeTenant({ id: "late", name: "Late" }),
        makeTenant({ id: "unpaid", name: "Unpaid" }),
      ];
      const payments = [paidFor("ontime", "2026-08", 3), paidFor("late", "2026-08", 10)];

      const { tenants: rows } = build(tenants, payments).months.at(-1)!;

      expect(rows).toEqual([
        { id: "unpaid", name: "Unpaid", amount: 10000, state: "overdue", paidOn: null, daysLate: 9 },
        { id: "late", name: "Late", amount: 10000, state: "late", paidOn: "2026-09-10", daysLate: 3 },
        { id: "ontime", name: "On time", amount: 10000, state: "on_time", paidOn: "2026-09-03", daysLate: null },
      ]);
    });

    it("totals by bank", () => {
      const tenants = [
        makeTenant({ id: "a", bank: "UCO", base_rent: 5000 }),
        makeTenant({ id: "b", bank: "UCO", base_rent: 3000 }),
        makeTenant({ id: "c", bank: " ", base_rent: 1000 }),
      ];

      const { byBank } = build(tenants, [paidFor("a", "2026-08", 3)]).months.at(-1)!;

      expect(byBank).toEqual([
        { bank: "UCO", expected: 8000, collected: 5000, collectedPct: 63 },
        { bank: null, expected: 1000, collected: 0, collectedPct: 0 },
      ]);
    });

    it("names who moved in, who moved out and whose rent changed", () => {
      const tenants = [
        makeTenant({ id: "new", name: "New", tenant_since: "2026-08-01" }),
        makeTenant({ id: "leaving", name: "Leaving", active: false, vacated_on: "2026-08-31" }),
        makeTenant({
          id: "raised",
          name: "Raised",
          base_rent: 10000,
          base_rent_as_of: "2026-01-01",
          increase_month: "August",
          increase_by: 500,
          increase_type: "flat",
        }),
      ];

      const { changes } = build(tenants, []).months.at(-1)!;

      expect(changes).toEqual({
        movedIn: [{ id: "new", name: "New", amount: 10000 }],
        movedOut: [{ id: "leaving", name: "Leaving", amount: 10000 }],
        rentChanges: [{ id: "raised", name: "Raised", from: 10000, to: 10500, change: 500 }],
      });
    });
  });

  describe("without a user-level session", () => {
    it("keeps totals but drops everything that names a tenant", () => {
      const tenants = [
        makeTenant({
          id: "a",
          security_deposit: 20000,
          base_rent_as_of: "2026-01-01",
          increase_month: "October",
          increase_by: 500,
          increase_type: "flat",
        }),
      ];

      const result = build(tenants, [], { unlocked: false });
      const august = result.months.at(-1)!;

      expect(result.unlocked).toBe(false);
      expect(august.expected).toBe(10000);
      expect(august.tenants).toEqual([]);
      expect(august.byBank).toEqual([]);
      expect(august.changes).toBeNull();
      expect(result.summary?.monthlyRent).toBe(10000);
      expect(result.ahead?.total).toBeGreaterThan(0);
      expect(result.ahead?.increases).toEqual([]);
      expect(result.alerts).toEqual([]);
      expect(result.currentTenants).toEqual([]);
      expect(result.formerTenants).toEqual([]);
      expect(result.deposits).toBeNull();
    });
  });

  describe("summary", () => {
    it("keeps what current tenants owe apart from what former tenants left unpaid", () => {
      const tenants = [
        makeTenant({ id: "here", base_rent: 8000 }),
        makeTenant({ id: "gone", base_rent: 3000, active: false, vacated_on: "2026-05-31" }),
      ];
      const payments = [
        ...paidRange("here", "2023-12", "2026-07", 5),
        ...paidRange("gone", "2023-12", "2026-04", 5),
      ];

      const { summary } = build(tenants, payments);

      expect(summary).toMatchObject({
        latestMonth: "2026-08",
        currentMonth: "2026-09",
        monthlyRent: 8000,
        currentTenants: 1,
        overdueAmount: 8000,
        overdueTenants: 1,
        formerOwedAmount: 3000,
        formerOwedTenants: 1,
      });
    });

    it("counts overdue rent from before the window too", () => {
      const tenants = [makeTenant({ id: "a" })];
      const payments = paidRange("a", "2023-12", "2026-08", 5).filter(
        (p) => p.month !== getPaymentMonth("2024-03")
      );

      const { summary } = build(tenants, payments, { windowMonths: 3 });

      expect(summary?.overdueAmount).toBe(10000);
      expect(summary?.windowCollectedPct).toBe(100);
    });
  });

  describe("financial years", () => {
    it("totals April to March by rent month, newest first, flagging a year history starts partway into", () => {
      const tenants = [makeTenant({ id: "a", base_rent: 1000 })];
      const payments = paidRange("a", "2023-12", "2026-08", 5);

      const { fiscalYears } = build(tenants, payments);

      expect(fiscalYears.map((y) => [y.label, y.from, y.to, y.expected, y.isCurrent, y.startsLate])).toEqual([
        ["2026-27", "2026-04", "2026-08", 5000, true, false],
        ["2025-26", "2025-04", "2026-03", 12000, false, false],
        ["2024-25", "2024-04", "2025-03", 12000, false, false],
      ]);
      expect(fiscalYears[0].collectedPct).toBe(100);
    });

    it("marks the first year as partial when history begins mid-year", () => {
      const tenants = [makeTenant({ id: "a", base_rent: 1000 })];

      const { fiscalYears } = build(tenants, [], { today: "2024-06-10" });

      expect(fiscalYears.at(-1)).toMatchObject({ label: "2023-24", from: "2023-12", to: "2024-03", startsLate: true });
    });
  });

  describe("ahead", () => {
    it("projects a year from the month in progress, with scheduled increases and known move-outs", () => {
      const tenants = [
        makeTenant({
          id: "a",
          name: "Asha",
          base_rent: 10000,
          base_rent_as_of: "2026-01-01",
          increase_month: "November",
          increase_by: 1000,
          increase_type: "flat",
        }),
        makeTenant({ id: "b", base_rent: 5000, active: false, vacated_on: "2026-10-31" }),
      ];

      const { ahead } = build(tenants, []);

      expect(ahead?.months.slice(0, 4)).toEqual([
        { month: "2026-09", expected: 15000 },
        { month: "2026-10", expected: 15000 },
        { month: "2026-11", expected: 11000 },
        { month: "2026-12", expected: 11000 },
      ]);
      expect(ahead?.months).toHaveLength(12);
      expect(ahead?.increases).toEqual([
        { id: "a", name: "Asha", month: "2026-11", from: 10000, to: 11000, change: 1000 },
      ]);
    });
  });

  describe("tenants", () => {
    it("describes a current tenant's behaviour over the window", () => {
      const tenant = makeTenant({
        id: "a",
        name: "Asha",
        tenant_since: "2019-11-01",
        base_rent: 20000,
        security_deposit: "50000",
        bank: "UCO",
      });
      const payments = [
        ...paidRange("a", "2023-12", "2026-05", 4),
        paidFor("a", "2026-06", 12), // late
        paidFor("a", "2026-07", 5),
        // August unpaid
      ];

      const [asha] = build([tenant], payments, { windowMonths: 4 }).currentTenants;

      expect(asha).toMatchObject({
        name: "Asha",
        rent: 20000,
        sharePct: 100,
        yearsWithUs: 6,
        movedOutOn: null,
        bank: "UCO",
        deposit: 50000,
        depositMonths: 2.5,
        history: ["on_time", "late", "on_time", "overdue"],
        onTimeCount: 2,
        lateCount: 1,
        overdueCount: 1,
        settledCount: 4,
        onTimePct: 50,
        medianPayDay: 5,
        onTimeStreak: 0,
        owed: 20000,
        owedMonths: ["2026-08"],
        firstRentMonth: null,
      });
    });

    it("leaves history empty for months before a tenant moved in, and gives a newcomer their first rent month", () => {
      const tenants = [
        makeTenant({ id: "a", tenant_since: "2026-07-01" }),
        makeTenant({ id: "b", tenant_since: "2026-09-01" }),
      ];

      const { currentTenants } = build(tenants, [], { windowMonths: 3 });
      const byId = Object.fromEntries(currentTenants.map((t) => [t.id, t]));

      expect(byId.a.history).toEqual([null, "overdue", "overdue"]);
      expect(byId.b.history).toEqual([null, null, null]);
      expect(byId.b.firstRentMonth).toBe("2026-09");
    });

    it("counts a streak of on-time months, skipping one not yet due", () => {
      const tenant = makeTenant({ id: "a" });
      const payments = [
        paidFor("a", "2026-05", 10),
        ...paidRange("a", "2026-06", "2026-07", 3),
      ];

      const [a] = build([tenant], payments, { today: "2026-09-02" }).currentTenants;
      expect(a.onTimeStreak).toBe(2); // June and July; August isn't due yet
    });

    it("puts current tenants who owe first, then by rent; former tenants newest move-out first", () => {
      const tenants = [
        makeTenant({ id: "big", base_rent: 30000 }),
        makeTenant({ id: "small-owing", base_rent: 2000 }),
        makeTenant({ id: "mid", base_rent: 10000 }),
        makeTenant({ id: "left-early", active: false, vacated_on: "2025-01-31" }),
        makeTenant({ id: "left-late", active: false, vacated_on: "2026-06-30" }),
      ];
      const payments = [
        ...paidRange("big", "2023-12", "2026-08", 5),
        ...paidRange("mid", "2023-12", "2026-08", 5),
        ...paidRange("small-owing", "2023-12", "2026-07", 5),
      ];

      const result = build(tenants, payments);

      expect(result.currentTenants.map((t) => t.id)).toEqual(["small-owing", "big", "mid"]);
      expect(result.formerTenants.map((t) => t.id)).toEqual(["left-late", "left-early"]);
      expect(result.formerTenants[0]).toMatchObject({ movedOutOn: "2026-06-30", sharePct: null, yearsWithUs: null });
    });
  });

  describe("deposits", () => {
    it("totals what current tenants have deposited, and lists former tenants' deposits", () => {
      const tenants = [
        makeTenant({ id: "a", base_rent: 10000, security_deposit: 30000 }),
        makeTenant({ id: "b", base_rent: 10000, security_deposit: 0 }),
        makeTenant({ id: "gone", active: false, vacated_on: "2026-07-31", security_deposit: 5000 }),
        makeTenant({ id: "gone-none", active: false, vacated_on: "2026-07-31", security_deposit: 0 }),
      ];
      const payments = [
        ...paidRange("a", "2023-12", "2026-08", 5),
        ...paidRange("b", "2023-12", "2026-08", 5),
        ...paidRange("gone", "2023-12", "2026-07", 5),
        ...paidRange("gone-none", "2023-12", "2026-07", 5),
      ];

      const { deposits } = build(tenants, payments);

      expect(deposits).toEqual({
        held: 30000,
        heldMonths: 1.5,
        withoutDeposit: 1,
        current: [
          { id: "a", name: "Test Tenant", deposit: 30000, rent: 10000, depositMonths: 3, owed: 0, owedExceedsDeposit: false },
          { id: "b", name: "Test Tenant", deposit: 0, rent: 10000, depositMonths: 0, owed: 0, owedExceedsDeposit: false },
        ],
        former: [
          { id: "gone", name: "Test Tenant", deposit: 5000, movedOutOn: "2026-07-31", owed: 0 },
        ],
      });
    });
  });

  describe("alerts", () => {
    it("flags money owed, current tenants first and former last, saying when it is more than the deposit", () => {
      const tenants = [
        makeTenant({ id: "here", name: "Here", security_deposit: 50000 }),
        makeTenant({ id: "gone", name: "Gone", active: false, vacated_on: "2026-06-30", security_deposit: 5000 }),
      ];
      const payments = [
        ...paidRange("here", "2023-12", "2026-07", 5),
        ...paidRange("gone", "2023-12", "2026-04", 5),
      ];

      const overdue = build(tenants, payments).alerts.filter((a) => a.kind === "overdue");

      expect(overdue).toEqual([
        { kind: "overdue", id: "here", name: "Here", amount: 10000, months: ["2026-08"], isCurrent: true, exceedsDeposit: false },
        { kind: "overdue", id: "gone", name: "Gone", amount: 20000, months: ["2026-05", "2026-06"], isCurrent: false, exceedsDeposit: true },
      ]);
    });

    it("flags a new run of late payments but not a tenant who is always late", () => {
      const tenants = [
        makeTenant({ id: "slipped", name: "Slipped" }),
        makeTenant({ id: "always", name: "Always" }),
      ];
      const payments = [
        ...paidRange("slipped", "2023-12", "2026-06", 4),
        ...paidRange("slipped", "2026-07", "2026-08", 11),
        ...paidRange("always", "2023-12", "2026-08", 11),
      ];

      const alerts = build(tenants, payments).alerts;

      expect(alerts).toContainEqual({ kind: "late_streak", id: "slipped", name: "Slipped", months: 2 });
      expect(alerts.some((a) => a.id === "always")).toBe(false);
    });

    it("flags someone paying noticeably later, while still on time", () => {
      const tenants = [makeTenant({ id: "a", name: "Asha" })];
      const payments = [
        ...paidRange("a", "2023-12", "2026-05", 1),
        ...paidRange("a", "2026-06", "2026-08", 7),
      ];

      const alerts = build(tenants, payments).alerts;

      expect(alerts).toEqual([
        { kind: "paying_later", id: "a", name: "Asha", usualDay: 1, recentDay: 7 },
      ]);
    });

    it("flags a rent increase only when it is close", () => {
      const soon = makeTenant({
        id: "soon",
        name: "Soon",
        base_rent_as_of: "2026-01-01",
        increase_month: "November",
        increase_by: 500,
        increase_type: "flat",
      });
      const later = makeTenant({
        id: "later",
        name: "Later",
        base_rent_as_of: "2026-01-01",
        increase_month: "March",
        increase_by: 500,
        increase_type: "flat",
      });
      const payments = [
        ...paidRange("soon", "2023-12", "2026-08", 3),
        ...paidRange("later", "2023-12", "2026-08", 3),
      ];

      const result = build([soon, later], payments);

      expect(result.alerts).toEqual([
        { kind: "increase_soon", id: "soon", name: "Soon", month: "2026-11", from: 10000, to: 10500, change: 500 },
      ]);
      expect(result.ahead?.increases.map((c) => c.id)).toEqual(["soon", "later"]);
    });
  });
});
