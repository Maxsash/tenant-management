import { getSheetRows } from "@/lib/sheets";
import { NextResponse } from "next/server";

const GLOBAL_CUTOFF = "2023-12";

// WhatsApp worker URL
const WHATSAPP_WORKER_URL =
  process.env.WHATSAPP_WORKER_URL || "http://localhost:4005";

export async function POST(req: Request) {
  try {
    const { month } = await req.json();

    const [tenants, payments] = await Promise.all([
      getSheetRows("tenants"),
      getSheetRows("payments"),
    ]);

    const paidIds = payments
      .filter((p: any) => p.month === month && p.paid_on)
      .map((p: any) => p.tenant_id);

    const unpaid = tenants.filter(
      (t: any) => !paidIds.includes(t.id) && t.phone
    );

    const recipients = unpaid.map((t: any) => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
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
          month,
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