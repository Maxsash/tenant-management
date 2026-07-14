import { getSheetRows } from "@/lib/sheets";
import { calculateRent, getRentMonth } from "@/lib/rent";
import { NextResponse } from "next/server";
import { getActiveTenants } from "@/lib/tenant";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const month =
    searchParams.get("month") ?? currentMonth();

  const [tenants, payments] = await Promise.all([
    getSheetRows<Tenant>("tenants"),
    getSheetRows<Payment>("payments"),
  ]);

  const paymentsThisMonth = payments.filter(
    (p) => p.month === month
  );

  const rentMonth = getRentMonth(month);

  const activeTenants = getActiveTenants(tenants, rentMonth);

  const result = activeTenants.map((t) => {
    const payment = paymentsThisMonth.find(
      (p) => p.tenant_id === t.id
    );

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
      paid: !!payment?.paid_on,
      paid_on: payment?.paid_on ?? null,
    };
  });

  return NextResponse.json({
    month,
    tenants: result,
  });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}