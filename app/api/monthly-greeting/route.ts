// app/api/whatsapp/monthly-greeting/route.ts

import { getTenants } from "@/lib/db";
import { NextResponse } from "next/server";
import { calculateRent } from "@/lib/rent";
import { getActiveTenants } from "@/lib/tenant";
import { Tenant } from "@/types/tenant";

const WHATSAPP_WORKER_URL =
  process.env.WHATSAPP_WORKER_URL || "http://localhost:4005";

export async function POST(req: Request) {
  try {
    // `month` from the client is the rent month being checked (matches
    // the dashboard's month selector), not the payment month.
    const { month: rentMonth } = await req.json();

    const tenants = await getTenants<Tenant>();

    // Active tenants only
    const activeTenants = getActiveTenants(tenants, rentMonth);

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