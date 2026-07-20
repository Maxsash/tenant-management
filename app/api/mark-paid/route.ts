import { getSheetRows, appendSheetRow } from "@/lib/sheets";
import { getPaymentMonth } from "@/lib/rent";
import type { Payment } from "@/types/payment";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // `month` from the client is the rent month being marked paid (matches
  // the dashboard's month selector). The sheet stores the payment month
  // (rent month + 1), so convert before writing/comparing.
  const { tenant_id, month: rentMonth, paid_on } = await req.json();
  const paymentMonth = getPaymentMonth(rentMonth);

  // Check if row already exists
  const payments = await getSheetRows<Payment>("payments");
  const exists = payments.find(
    (p) => p.tenant_id === tenant_id && (p as any).rent_month === rentMonth
  );

  if (exists) {
    return NextResponse.json({ error: "Already marked paid" }, { status: 400 });
  }

  await appendSheetRow("payments", [tenant_id, paymentMonth, paid_on, ""]);
  return NextResponse.json({ ok: true });
}