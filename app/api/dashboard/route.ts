import { getSheetRows } from "@/lib/sheets";
import { calculateRent, getRentMonth } from "@/lib/rent";
import { NextResponse } from "next/server";
import { getActiveTenants } from "@/lib/tenant";
import { evaluatePaymentStatus } from "@/lib/payment-status";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // paymentDueMonth: the month when rent payment is due (e.g., "2026-07" for June rent)
  const paymentDueMonth =
    searchParams.get("month") ?? currentMonth();

  const [tenants, payments] = await Promise.all([
    getSheetRows<Tenant>("tenants"),
    getSheetRows<Payment>("payments"),
  ]);

  // rentMonth: the month the rent is for (e.g., "2026-06" if payment is due in July)
  const rentMonth = getRentMonth(paymentDueMonth);

  const paymentsForRent = payments.filter(
    (p) => p.month === paymentDueMonth
  );

  const activeTenants = getActiveTenants(tenants, rentMonth);

  const result = activeTenants.map((t) => {
    const paymentStatus = evaluatePaymentStatus({
      tenant: t,
      payments: paymentsForRent,
      paymentDueMonth,
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
    month: paymentDueMonth,
    tenants: result,
  });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}