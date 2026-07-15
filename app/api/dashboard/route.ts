import { getSheetRows } from "@/lib/sheets";
import { calculateRent, getRentMonth } from "@/lib/rent";
import { NextResponse } from "next/server";
import { getActiveTenants } from "@/lib/tenant";
import { evaluatePaymentStatus } from "@/lib/payment-status";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // `paymentMonth`: the month the payment occurred / UI selection (e.g., "2026-07")
  const paymentMonth = searchParams.get("month") ?? currentMonth();

  const [tenants, payments] = await Promise.all([
    getSheetRows<Tenant>("tenants"),
    getSheetRows<Payment>("payments"),
  ]);

  // rentMonth: the month the rent is for (e.g., "2026-06" if payment is in July)
  const rentMonth = getRentMonth(paymentMonth);

  // Payments were read from the sheet and `getSheetRows` now provides
  // `payment_month` and `rent_month` fields. Filter by `rent_month`.
  const paymentsForRent = payments.filter((p) => (p as any).rent_month === rentMonth);

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
    payment_month: paymentMonth,
    rent_month: rentMonth,
    tenants: result,
  });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}