import { getPayments, insertPayment } from "@/lib/db";
import { getPaymentMonth } from "@/lib/rent";
import { currentDate } from "@/lib/date";
import type { Payment } from "@/types/payment";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // `month` from the client is the rent month being marked paid (matches
    // the dashboard's month selector). The payments table stores the
    // payment month (rent month + 1), so convert before writing/comparing.
    const { tenant_id, month: rentMonth, paid_on } = await req.json();

    if (!tenant_id || !rentMonth) {
      return NextResponse.json(
        { error: "tenant_id and month are required" },
        { status: 400 }
      );
    }

    const paymentMonth = getPaymentMonth(rentMonth);

    // Check if row already exists
    const payments = await getPayments<Payment>();
    const exists = payments.find(
      (p) => p.tenant_id === tenant_id && (p as any).rent_month === rentMonth
    );

    if (exists) {
      return NextResponse.json({ error: "Already marked paid" }, { status: 400 });
    }

    // Stamp paid_on with the server's clock when the client omits it,
    // rather than trusting a client-computed date.
    await insertPayment({
      tenant_id,
      month: paymentMonth,
      paid_on: paid_on || currentDate(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}