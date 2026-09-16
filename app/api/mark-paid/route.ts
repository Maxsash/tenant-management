import { getPayments, insertPayment, updatePaymentPaidOn } from "@/lib/db";
import { getPaymentMonth } from "@/lib/rent";
import { currentDate, isValidMonth } from "@/lib/date";
import { findRentPayment, getPaidOnError } from "@/lib/payments";
import { hasAdminSession } from "@/lib/admin-auth";
import type { Payment } from "@/types/payment";
import { NextResponse } from "next/server";

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

// Records a tenant's rent as paid. `paid_on` is optional: omitted, it is the
// server's today; given, it is usually an earlier date, for rent that was paid
// before anyone got round to marking it.
export async function POST(req: Request) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  try {
    // `month` from the client is the rent month being marked paid (matches
    // the dashboard's month selector). The payments table stores the
    // payment month (rent month + 1), so convert before writing/comparing.
    const { tenant_id, month: rentMonth, paid_on } = await req.json();

    if (!tenant_id || !rentMonth) {
      return badRequest("tenant_id and month are required");
    }

    if (!isValidMonth(rentMonth)) {
      return badRequest("Invalid month. Expected YYYY-MM");
    }

    // Stamp paid_on with the server's clock when the client omits it. A date
    // the client does send is checked, not trusted.
    const today = currentDate();
    const paidOn = paid_on || today;
    const dateError = getPaidOnError(paidOn, today);

    if (dateError) {
      return badRequest(dateError);
    }

    const payments = await getPayments<Payment>();
    const existing = findRentPayment(payments, tenant_id, rentMonth);

    if (existing?.paid_on) {
      return badRequest("Already marked paid");
    }

    // A row with no paid_on reads as pending everywhere, so the dashboard
    // offers "Mark as Paid" for it — fill that row in rather than refusing
    // or adding a duplicate beside it.
    if (existing && existing.id != null) {
      await updatePaymentPaidOn(existing.id, paidOn);
    } else {
      await insertPayment({
        tenant_id,
        month: getPaymentMonth(rentMonth),
        paid_on: paidOn,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Changes the date on rent already marked paid — typically moving it earlier
// when it was marked days after the money actually arrived, which can turn a
// "late" month back into an on-time one.
export async function PATCH(req: Request) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  try {
    const { tenant_id, month: rentMonth, paid_on } = await req.json();

    if (!tenant_id || !rentMonth || !paid_on) {
      return badRequest("tenant_id, month and paid_on are required");
    }

    if (!isValidMonth(rentMonth)) {
      return badRequest("Invalid month. Expected YYYY-MM");
    }

    const dateError = getPaidOnError(paid_on, currentDate());

    if (dateError) {
      return badRequest(dateError);
    }

    const payments = await getPayments<Payment>();
    const existing = findRentPayment(payments, tenant_id, rentMonth);

    if (!existing || existing.id == null) {
      return NextResponse.json(
        { error: "No payment recorded for this month" },
        { status: 404 }
      );
    }

    await updatePaymentPaidOn(existing.id, paid_on);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
