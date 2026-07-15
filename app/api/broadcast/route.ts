import { getSheetRows } from "@/lib/sheets";
import { NextResponse } from "next/server";
import { calculateRent, getRentMonth } from "@/lib/rent";
import { getActiveTenants } from "@/lib/tenant";
import { evaluatePaymentStatus } from "@/lib/payment-status";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

const GLOBAL_CUTOFF = "2023-12";

// WhatsApp worker URL
const WHATSAPP_WORKER_URL =
  process.env.WHATSAPP_WORKER_URL || "http://localhost:4005";

export async function POST(req: Request) {
  try {
    const { month: paymentDueMonth } = await req.json();

    const [tenants, payments] = await Promise.all([
      getSheetRows<Tenant>("tenants"),
      getSheetRows<Payment>("payments"),
    ]);

    const rentMonth = getRentMonth(paymentDueMonth);

    const activeTenants = getActiveTenants(tenants, rentMonth);

    const unpaid = activeTenants.filter((t) => {
      const paymentStatus = evaluatePaymentStatus({
        tenant: t,
        payments,
        paymentDueMonth,
      });

      return paymentStatus.status === "pending" && t.phone;
    });

    const recipients = unpaid.map((t) => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      rent: calculateRent(t, rentMonth),
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
          month: paymentDueMonth,
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