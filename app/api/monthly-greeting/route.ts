// app/api/whatsapp/monthly-greeting/route.ts

import { getSheetRows } from "@/lib/sheets";
import { NextResponse } from "next/server";
import { calculateRent, getRentMonth } from "@/lib/rent";

const WHATSAPP_WORKER_URL =
  process.env.WHATSAPP_WORKER_URL || "http://localhost:4005";

export async function POST(req: Request) {
  try {
    const { month } = await req.json();

    const tenants = await getSheetRows("tenants");

    // Active tenants only
    const rentMonth = getRentMonth(month);

    const activeTenants = tenants.filter((t: any) => {
      if (t.tenant_since) {
        const onboardMonth = String(t.tenant_since).slice(0, 7);
        if (rentMonth <= onboardMonth) return false;
      }

      if (String(t.active).toLowerCase() === "true") return true;

      if (!t.vacated_on) return false;

      const vacatedMonth = String(t.vacated_on).slice(0, 7);

      return rentMonth <= vacatedMonth;
    });

    const recipients = activeTenants
      .filter((t: any) => t.phone)
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
        rent: calculateRent(t, rentMonth),
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