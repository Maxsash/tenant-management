import { getTenants } from "@/lib/db";
import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { isValidMonth } from "@/lib/date";
import { buildWhatsAppMessage, getGreetingRecipients } from "@/lib/whatsapp";
import { Tenant } from "@/types/tenant";

const WHATSAPP_WORKER_URL =
  process.env.WHATSAPP_WORKER_URL || "http://localhost:4005";

export async function POST(req: Request) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  try {
    // `month` from the client is the rent month being checked (matches
    // the dashboard's month selector), not the payment month.
    const { month: rentMonth } = await req.json();

    if (!isValidMonth(rentMonth)) {
      return NextResponse.json({ error: "Invalid month. Expected YYYY-MM" }, { status: 400 });
    }

    const tenants = await getTenants<Tenant>();

    // The worker sends exactly the text it's given — wording lives in
    // lib/whatsapp.ts, shared with the tap-to-send links.
    const recipients = getGreetingRecipients(tenants, rentMonth)
      .filter((r) => r.phone)
      .map((r) => ({
        ...r,
        message: buildWhatsAppMessage("greeting", r.rent, rentMonth),
      }));

    // 🚀 CALL WHATSAPP WORKER
    const whatsappRes = await fetch(
      `${WHATSAPP_WORKER_URL}/send-monthly-greeting`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients,
          month: rentMonth,
        }),
      }
    );

    const data = await whatsappRes.json();

    if (!whatsappRes.ok) {
      return NextResponse.json(
        { error: data.error || "WhatsApp worker failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sent: data.sent,
      totalRecipients: recipients.length,
      results: data.results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}