import { monthRange } from "@/lib/date";
import { calculateRent } from "@/lib/rent";
import {
  buildPaymentHistory,
  getOnTimeDeadline,
  type PaymentStatus,
} from "@/lib/payment-status";
import { getActiveTenants } from "@/lib/tenant";
import type { Payment } from "@/types/payment";
import type { Tenant } from "@/types/tenant";

/**
 * The earliest rent month the app reports on, however far back a tenancy
 * goes — records before it predate reliable data.
 */
export const HISTORY_START = "2023-12";

export interface RentLedgerEntry {
  tenant: Tenant;
  rent_month: string;
  /** From lib/rent.ts#calculateRent — the payments table holds no amounts. */
  amount: number;
  status: PaymentStatus;
  paid_on: string | null;
  /** The last day this month's rent still counts as on time. */
  due_by: string;
}

/**
 * One entry for every month each tenant owed rent, between `from` and `to`
 * inclusive: chronological, and within a month in the order `tenants` came in.
 *
 * This is the only place a tenant and a rent month are put together, so every
 * screen that shows rent — the dashboard, a tenant's history, the insights —
 * agrees on the three questions underneath it:
 *  - did they owe rent that month: lib/tenant.ts#getActiveTenants
 *  - how much: lib/rent.ts#calculateRent
 *  - was it paid, and on time: lib/payment-status.ts#evaluatePaymentStatus
 * Answer any of them somewhere else and two screens will eventually disagree.
 */
export function buildRentLedger(
  tenants: Tenant[],
  payments: Payment[],
  { from, to }: { from: string; to: string }
): RentLedgerEntry[] {
  const months = monthRange(from, to);
  if (months.length === 0) return [];

  const paymentsByTenant = new Map<string, Payment[]>();
  for (const payment of payments) {
    const rows = paymentsByTenant.get(payment.tenant_id) ?? [];
    rows.push(payment);
    paymentsByTenant.set(payment.tenant_id, rows);
  }

  // Statuses are built per tenant up front; which months a tenant actually
  // owed is decided per month below.
  const historyByTenant = new Map(
    tenants.map((tenant) => [
      tenant.id,
      new Map(
        buildPaymentHistory({
          tenant,
          payments: paymentsByTenant.get(tenant.id) ?? [],
          fromMonth: from,
          toMonth: to,
        }).map((entry) => [entry.month, entry])
      ),
    ])
  );

  const ledger: RentLedgerEntry[] = [];

  for (const month of months) {
    for (const tenant of getActiveTenants(tenants, month)) {
      const history = historyByTenant.get(tenant.id)?.get(month);
      if (!history) continue;

      ledger.push({
        tenant,
        rent_month: month,
        amount: calculateRent(tenant, month),
        status: history.status,
        paid_on: history.paid_on,
        due_by: getOnTimeDeadline(month) as string,
      });
    }
  }

  return ledger;
}
