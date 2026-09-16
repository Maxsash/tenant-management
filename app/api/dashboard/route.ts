import { getTenants, getPayments } from "@/lib/db";
import { NextResponse } from "next/server";
import { getOnTimeDeadline } from "@/lib/payment-status";
import { getRentMonth } from "@/lib/rent";
import { buildRentLedger, HISTORY_START } from "@/lib/rent-ledger";
import { overdueTotals } from "@/lib/rent-analytics";
import { currentDate, currentMonth } from "@/lib/date";
import { hasUserSession } from "@/lib/admin-auth";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const unlocked = hasUserSession(req);

  // The month selector on the dashboard represents the rent month
  // being checked (e.g. "2026-07" = rent for July), not the month the
  // payment occurred.
  const rentMonth = searchParams.get("month") ?? currentMonth();

  const [tenants, payments] = await Promise.all([
    getTenants<Tenant>(),
    getPayments<Payment>(),
  ]);

  // Who owed rent this month, how much, and whether it came in — the same
  // derivation a tenant's history and the insights screen use.
  const ledger = buildRentLedger(tenants, payments, {
    from: rentMonth,
    to: rentMonth,
  });

  const result = ledger.map(({ tenant: t, amount, status, paid_on }) => {
    // Personal info (phone, financial/lease details) is only included once
    // the caller has at least a user-level session — a stranger hitting
    // this route directly should only ever see name/amount/paid-status.
    const personalInfo = unlocked
      ? {
          phone: t.phone,
          tenant_since: t.tenant_since,
          security_deposit: t.security_deposit,
          bank: t.bank,
          increase_month: t.increase_month,
          increase_type: t.increase_type,
          increase_by: t.increase_by,
        }
      : {};

    return {
      id: t.id,
      name: t.name,
      property_type: t.property_type,
      amount,
      paid: status !== "pending",
      paid_on,
      ...personalInfo,
    };
  });

  // The dashboard shows one month at a time, so a tenant who skipped some
  // other month is invisible unless someone happens to pick it. This is the
  // total of that, for current tenants — the month on screen is left out,
  // since its unpaid rent is already listed.
  const today = currentDate();
  const stillHere = new Set(
    buildRentLedger(tenants, payments, {
      from: currentMonth(),
      to: currentMonth(),
    }).map((e) => e.tenant.id)
  );
  const otherMonths = buildRentLedger(tenants, payments, {
    from: HISTORY_START,
    to: getRentMonth(currentMonth()),
  }).filter((e) => e.rent_month !== rentMonth);

  return NextResponse.json({
    rent_month: rentMonth,
    // Shown when choosing a payment date, so back-dating is an informed choice.
    on_time_by: getOnTimeDeadline(rentMonth),
    tenants: result,
    overdue_other_months: overdueTotals(otherMonths, today, stillHere).current,
    unlocked,
  });
}
