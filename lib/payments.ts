import { isValidDate } from "@/lib/date";
import type { Payment } from "@/types/payment";

// How many days past the server's "today" a payment date may be. The server
// clock is UTC and the household is in India (UTC+5:30), so for the first five
// and a half hours of every Indian day, rent paid "today" is dated tomorrow as
// far as UTC is concerned. One day of grace keeps that from being refused.
export const PAID_ON_FUTURE_GRACE_DAYS = 1;

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Why `paidOn` can't be recorded as the date rent was paid, or null if it can.
 * Earlier dates are allowed without limit — back-dating a payment that was
 * marked late, or recording an advance, is the point.
 */
export function getPaidOnError(paidOn: unknown, today: string): string | null {
  if (!isValidDate(paidOn)) {
    return "Invalid payment date. Expected YYYY-MM-DD";
  }

  if (paidOn > addDays(today, PAID_ON_FUTURE_GRACE_DAYS)) {
    return "Payment date can't be in the future";
  }

  return null;
}

/** The payment recorded for a tenant's rent month, if any. Matches on
 *  `rent_month` (as derived by lib/db.ts#getPayments), never the raw `month`
 *  column, which holds the payment month. */
export function findRentPayment(
  payments: Payment[],
  tenantId: string,
  rentMonth: string
): Payment | undefined {
  return payments.find((p) => p.tenant_id === tenantId && p.rent_month === rentMonth);
}
