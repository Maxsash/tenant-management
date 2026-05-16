import { getSheetRows } from "@/lib/sheets";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? currentMonth();

  const [tenants, payments, schedule] = await Promise.all([
    getSheetRows("tenants"),
    getSheetRows("payments"),
    getSheetRows("rent_schedule"),
  ]);

  const paymentsThisMonth = payments.filter((p) => p.month === month);
  const scheduleThisMonth = schedule.filter((s) => s.month === month);

  const result = tenants.map((t) => {
    const payment = paymentsThisMonth.find((p) => p.tenant_id === t.id);
    const rent = scheduleThisMonth.find((s) => s.tenant_id === t.id);
    return {
      id: t.id,
      name: t.name,
      phone: t.phone,
      property_type: t.property_type,
      amount: rent?.amount ?? "—",
      paid: !!payment?.paid_on,
      paid_on: payment?.paid_on ?? null,
    };
  });

  return NextResponse.json({ month, tenants: result });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "2025-05"
}