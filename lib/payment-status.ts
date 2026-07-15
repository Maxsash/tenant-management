import type { Payment } from "../types/payment.ts";
import type { Tenant } from "../types/tenant.ts";

export type PaymentStatus = "paid" | "late" | "pending";

export interface PaymentMonthStatus {
  month: string; // payment due month (YYYY-MM format)
  status: PaymentStatus;
  isLate: boolean;
  paid_on: string | null;
  payment: Payment | null;
}

export interface PaymentStatusResult extends PaymentMonthStatus {}

function createPendingStatus(paymentDueMonth: string): PaymentStatusResult {
  return {
    month: paymentDueMonth,
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
  paymentDueMonth,
  onTimeDayLimit = 7,
}: {
  tenant: Tenant;
  payments: Payment[];
  paymentDueMonth: string;
  onTimeDayLimit?: number;
}): PaymentStatusResult {
  // Validate rent month format
  if (!paymentDueMonth || !/^\d{4}-\d{2}$/.test(paymentDueMonth)) {
    return createPendingStatus(paymentDueMonth);
  }

  console.log(`Evaluating payment status for tenant ${tenant.id} for rent month ${paymentDueMonth}`);
  console.log('Payments:', payments);

  // Find payment record for this tenant and rent month
  const payment = payments.find(
    (row) => row.tenant_id === tenant.id && row.month === paymentDueMonth
  );

  console.log('Found payment:', payment, 'For tenant:', tenant.id, 'rent month:', paymentDueMonth);

  if (!payment || !payment.paid_on) {
    return createPendingStatus(paymentDueMonth);
  }

  const paidDate = new Date(payment.paid_on);

  if (Number.isNaN(paidDate.getTime())) {
    return createPendingStatus(paymentDueMonth);
  }

  // Extract the month from paid_on date
  const paidYear = paidDate.getFullYear();
  const paidMonthNum = paidDate.getMonth() + 1;
  const paidMonth = `${paidYear}-${String(paidMonthNum).padStart(2, "0")}`;

  // Determine if late: paid in a different month, or paid after day 7 in the same month
  const isLate =
    paidMonth > paymentDueMonth ||
    (paidMonth === paymentDueMonth && paidDate.getDate() > onTimeDayLimit);

  return {
    month: paymentDueMonth,
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
    const paymentDueMonth = `${current.getFullYear()}-${String(
      current.getMonth() + 1
    ).padStart(2, "0")}`;

    history.push(
      evaluatePaymentStatus({
        tenant,
        payments,
        paymentDueMonth,
        onTimeDayLimit,
      })
    );

    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return history;
}
