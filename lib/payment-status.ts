import type { Payment } from "../types/payment.ts";
import type { Tenant } from "../types/tenant.ts";
import { getRentMonth } from "@/lib/rent";

export type PaymentStatus = "paid" | "late" | "pending";

export interface PaymentMonthStatus {
  month: string; // rent_month (YYYY-MM format)
  rent_month?: string;
  status: PaymentStatus;
  isLate: boolean;
  paid_on: string | null;
  payment: Payment | null;
}

export type PaymentStatusResult = PaymentMonthStatus;

type PaymentWithRentMonth = Payment & {
  rent_month?: string;
};

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

function parseMonth(month: string): { year: number; month: number } | null {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [year, monthNumber] = month.split("-").map(Number);

  if (
    Number.isNaN(year) ||
    Number.isNaN(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return null;
  }

  return {
    year,
    month: monthNumber,
  };
}

function parseDate(date: string): Date | null {
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getDueDate(rentMonth: string, onTimeDayLimit: number): Date | null {
  const parsed = parseMonth(rentMonth);

  if (!parsed) {
    return null;
  }

  return new Date(parsed.year, parsed.month, onTimeDayLimit);
}

/**
 * Evaluate payment status for a tenant's rent for a specific month.
 *
 * Business rule: Rent for June is due in July, classified as late if paid after July 7.
 *
 * @param tenant - The tenant record
 * @param payments - Payment records. `month` / `payment_month` is the payment month; `rent_month` is optional.
 * @param rentMonth - The month the rent is for (YYYY-MM format)
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
  if (!parseMonth(rentMonth)) {
    return createPendingStatus(rentMonth);
  }

  // Find a payment that belongs to the tenant and maps to this rentMonth.
  const payment = payments.find((row) => {
    if (row.tenant_id !== tenant.id) return false;

    const normalizedRow = row as PaymentWithRentMonth;

    if (normalizedRow.rent_month) {
      return normalizedRow.rent_month === rentMonth;
    }

    const paymentMonth = String(normalizedRow.payment_month ?? normalizedRow.month ?? "").slice(0, 7);
    if (!paymentMonth) return false;

    const derivedRent = getRentMonth(paymentMonth);
    return derivedRent === rentMonth;
  });

  if (!payment || !payment.paid_on) {
    return createPendingStatus(rentMonth);
  }

  const paidDate = parseDate(payment.paid_on);
  const dueDate = getDueDate(rentMonth, onTimeDayLimit);

  if (!paidDate || !dueDate) {
    return createPendingStatus(rentMonth);
  }

  const isLate = paidDate > dueDate;

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
