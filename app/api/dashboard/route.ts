import { getSheetRows } from "@/lib/sheets";
import { calculateRent } from "@/lib/rent";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const month =
    searchParams.get("month") ?? currentMonth();

  const [tenants, payments] = await Promise.all([
    getSheetRows("tenants"),
    getSheetRows("payments"),
  ]);

  const paymentsThisMonth = payments.filter(
    (p) => p.month === month
  );

  const activeTenants = tenants.filter(
  (t) => {
    if (t.active === false) {
      return false;
    }

    if (!t.vacated_on) {
      return true;
    }

    const vacatedDate = new Date(
      t.vacated_on
    );

    const [year, monthNum] =
      month.split("-");

    const targetDate = new Date(
      Number(year),
      Number(monthNum) - 1,
      1
    );

    return vacatedDate >= targetDate;
  }
);

  const result = activeTenants.map((t) => {
    const payment = paymentsThisMonth.find(
      (p) => p.tenant_id === t.id
    );

    const amount = calculateRent(t, month);

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