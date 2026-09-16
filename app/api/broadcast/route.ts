import { getTenants, getPayments } from "@/lib/db";
import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { isValidMonth } from "@/lib/date";
import { buildWhatsAppMessage, getReminderRecipients } from "@/lib/whatsapp";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

// WhatsApp worker URL
const WHATSAPP_WORKER_URL =
  process.env.WHATSAPP_WORKER_URL || "http://localhost:4005";

type BroadcastResult = {
  status?: string;
};

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

    const [tenants, payments] = await Promise.all([
      getTenants<Tenant>(),
      getPayments<Payment>(),
    ]);

    // The worker sends exactly the text it's given — wording lives in
    // lib/whatsapp.ts, shared with the tap-to-send links.
    const recipients = getReminderRecipients(tenants, payments, rentMonth)
      .filter((r) => r.phone)
      .map((r) => ({
        ...r,
        message: buildWhatsAppMessage("reminder", r.rent, rentMonth),
      }));

    // 🚀 CALL WHATSAPP WORKER
    const whatsappRes = await fetch(
      `${WHATSAPP_WORKER_URL}/send-broadcast`,
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
      console.error("WhatsApp worker failed broadcast request", {
        rentMonth,
        status: whatsappRes.status,
        workerResponse: data,
      });

      return NextResponse.json(
        {
          error: data.error || "WhatsApp worker failed",
          workerResponse: data,
        },
        { status: 500 }
      );
    }

    const failedResults =
      data.results?.filter(
        (result: BroadcastResult) => result.status === "failed"
      ) ?? [];

    if (failedResults.length > 0) {
      console.error("Broadcast completed with failed WhatsApp sends", {
        rentMonth,
        totalRecipients: recipients.length,
        sent: data.sent,
        failed: data.failed,
        failedResults,
      });
    }

    return NextResponse.json({
      success: true,
      sent: data.sent,
      totalRecipients: recipients.length,
      failed: data.failed,
      failedResults,
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
