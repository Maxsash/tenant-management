import type { Payment } from "../types/payment.ts";
import type { Tenant } from "../types/tenant.ts";
import { getRentMonth } from "@/lib/rent";

export type PaymentStatus = "paid" | "late" | "pending";

export interface PaymentMonthStatus {
  month: string; // rent_month (YYYY-MM format)
  // explicit alias
  rent_month?: string;
  status: PaymentStatus;
  isLate: boolean;
  paid_on: string | null;
  payment: Payment | null;
}

export interface PaymentStatusResult extends PaymentMonthStatus {}

function createPendingStatus(rentMonth: string): PaymentStatusResult {
  return {
    month: rentMonth,
    rent_month: rentMonth,
    status: "pending",
    isLate: false,
    paid_on: null,
    payment: null,
  };
}

/**
 * Evaluate payment status for a tenant's rent for a specific month.
 *
 * Business rule: Rent for June is due in July, classified as late if paid after July 7.
 *
 * @param tenant - The tenant record
 * @param payments - All payment records (should have month = rent_month)
 * @param paymentDueMonth - The month the rent will be paid on (YYYY-MM format)
 * @param onTimeDayLimit - Day limit for on-time payment (default: 7)
 * @returns Payment status result
 */
export function evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth,
  onTimeDayLimit = 7,
}: {
  tenant: Tenant;
  payments: Payment[];
  rentMonth: string;
  onTimeDayLimit?: number;
}): PaymentStatusResult {
  // Validate rent month format
  if (!rentMonth || !/^\d{4}-\d{2}$/.test(rentMonth)) {
    return createPendingStatus(rentMonth);
  }

  // Find a payment that belongs to the tenant and maps to this rentMonth.
  const payment = payments.find((row) => {
    if (row.tenant_id !== tenant.id) return false;

    // If the row already has explicit rent_month, use it
    if ((row as any).rent_month) {
      return (row as any).rent_month === rentMonth;
    }

    // Otherwise derive rent month from payment_month or month
    const pm = String((row as any).payment_month ?? row.month ?? "").slice(0, 7);
    if (!pm) return false;

    const derivedRent = getRentMonth(pm);
    return derivedRent === rentMonth;
  });

  if (!payment || !payment.paid_on) {
    return createPendingStatus(rentMonth);
  }

  const paidDate = new Date(payment.paid_on);

  if (Number.isNaN(paidDate.getTime())) {
    return createPendingStatus(rentMonth);
  }

  // Extract the month from paid_on date
  const paidYear = paidDate.getFullYear();
  const paidMonthNum = paidDate.getMonth() + 1;
  const paidMonth = `${paidYear}-${String(paidMonthNum).padStart(2, "0")}`;

  // Determine if late: paid in a different month, or paid after day limit in same month
  const isLate = paidMonth > rentMonth || (paidMonth === rentMonth && paidDate.getDate() > onTimeDayLimit);

  return {
    month: rentMonth,
    rent_month: rentMonth,
    status: isLate ? "late" : "paid",
    isLate,
    paid_on: payment.paid_on,
    payment,
  };
}

/**
 * Build payment history for a tenant across a range of rent months.
 *
 * @param tenant - The tenant record
 * @param payments - All payment records
 * @param fromMonth - Start rent month (YYYY-MM)
 * @param toMonth - End rent month (YYYY-MM)
 * @param onTimeDayLimit - Day limit for on-time payment (default: 7)
 * @returns Array of payment statuses for each month, chronological order
 */
export function buildPaymentHistory({
  tenant,
  payments,
  fromMonth,
  toMonth,
  onTimeDayLimit = 7,
}: {
  tenant: Tenant;
  payments: Payment[];
  fromMonth: string;
  toMonth: string;
  onTimeDayLimit?: number;
}): PaymentMonthStatus[] {
  // Validate month formats
  if (!fromMonth || !/^\d{4}-\d{2}$/.test(fromMonth)) {
    return [];
  }
  if (!toMonth || !/^\d{4}-\d{2}$/.test(toMonth)) {
    return [];
  }

  const [fromYear, fromMonthNum] = fromMonth.split("-").map(Number);
  const [toYear, toMonthNum] = toMonth.split("-").map(Number);

  const history: PaymentMonthStatus[] = [];
  let current = new Date(fromYear, fromMonthNum - 1, 1);
  const end = new Date(toYear, toMonthNum - 1, 1);

  while (current <= end) {
    const rentMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;

    history.push(
      evaluatePaymentStatus({
        tenant,
        payments,
        rentMonth,
        onTimeDayLimit,
      })
    );

    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return history;
}
