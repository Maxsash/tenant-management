import { getSheetRows } from "@/lib/sheets";
import { sendRentReminder } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("===== /api/broadcast HIT =====");

    // -----------------------------
    // AUTH CHECK
    // -----------------------------
    const secret = req.headers.get("x-api-secret");

    console.log("HEADER SECRET:", secret);
    console.log(
      "ENV API_SECRET EXISTS:",
      !!process.env.API_SECRET
    );

    if (secret !== process.env.API_SECRET) {
      console.error("UNAUTHORIZED REQUEST");

      return NextResponse.json(
        {
          error: "Unauthorized",
          received: secret,
        },
        { status: 401 }
      );
    }

    console.log("AUTH PASSED");

    // -----------------------------
    // BODY
    // -----------------------------
    const body = await req.json();

    console.log(
      "REQUEST BODY:",
      JSON.stringify(body, null, 2)
    );

    const { month } = body;

    console.log("MONTH:", month);

    // -----------------------------
    // FETCH SHEETS
    // -----------------------------
    console.log("FETCHING SHEETS...");

    const [tenants, payments] = await Promise.all([
      getSheetRows("tenants"),
      getSheetRows("payments"),
    ]);

    console.log("TENANTS COUNT:", tenants.length);
    console.log("PAYMENTS COUNT:", payments.length);

    // -----------------------------
    // FIND PAID TENANTS
    // -----------------------------
    const paidIds = payments
      .filter((p) => p.month === month && p.paid_on)
      .map((p) => p.tenant_id);

    console.log("PAID IDS:", paidIds);

    // -----------------------------
    // FIND UNPAID TENANTS
    // -----------------------------
    const unpaid = tenants.filter(
      (t) => !paidIds.includes(t.id) && t.phone
    );

    console.log(
      "UNPAID TENANTS:",
      unpaid.map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
      }))
    );

    // -----------------------------
    // SEND REMINDERS
    // -----------------------------
    console.log("SENDING REMINDERS...");

    const results = await Promise.allSettled(
      unpaid.map((t) =>
        sendRentReminder(t.phone, t.name)
      )
    );

    console.log(
      "SEND RESULTS:",
      JSON.stringify(results, null, 2)
    );

    // -----------------------------
    // SUCCESS RESPONSE
    // -----------------------------
    return NextResponse.json({
      success: true,
      sent: unpaid.map((t) => t.name),
      total: unpaid.length,
      results,
    });
  } catch (err) {
    console.error("BROADCAST ROUTE ERROR:", err);

    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : String(err),
      },
      { status: 500 }
    );
  }
}