import { getTenants, getPayments } from "@/lib/db";
import { calculateRent } from "@/lib/rent";
import { NextResponse } from "next/server";
import { getActiveTenants } from "@/lib/tenant";
import { evaluatePaymentStatus } from "@/lib/payment-status";
import { currentMonth } from "@/lib/date";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // The month selector on the dashboard represents the rent month
  // being checked (e.g. "2026-07" = rent for July), not the month the
  // payment occurred.
  const rentMonth = searchParams.get("month") ?? currentMonth();

  const [tenants, payments] = await Promise.all([
    getTenants<Tenant>(),
    getPayments<Payment>(),
  ]);

  // `getPayments` provides `payment_month` and `rent_month` fields
  // derived from the DB's `month` column. Filter by `rent_month`.
  const paymentsForRent = payments.filter((p) => p.rent_month === rentMonth);

  const activeTenants = getActiveTenants(tenants, rentMonth);

  const result = activeTenants.map((t) => {
    const paymentStatus = evaluatePaymentStatus({
      tenant: t,
      payments: paymentsForRent,
      rentMonth,
    });

    const amount = calculateRent(t, rentMonth);

    return {
      id: t.id,
      name: t.name,
      phone: t.phone,
      property_type: t.property_type,
      tenant_since: t.tenant_since,
      security_deposit: t.security_deposit,
      bank: t.bank,
      increase_month: t.increase_month,
      increase_type: t.increase_type,
      increase_by: t.increase_by,
      amount,
      paid: paymentStatus.status !== "pending",
      paid_on: paymentStatus.paid_on,
    };
  });

  return NextResponse.json({
    rent_month: rentMonth,
    tenants: result,
  });
}