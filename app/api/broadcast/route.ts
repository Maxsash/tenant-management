import { getSheetRows } from "@/lib/sheets";
import { NextResponse } from "next/server";
import { calculateRent } from "@/lib/rent";
import { getActiveTenants } from "@/lib/tenant";
import { evaluatePaymentStatus } from "@/lib/payment-status";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

// WhatsApp worker URL
const WHATSAPP_WORKER_URL =
  process.env.WHATSAPP_WORKER_URL || "http://localhost:4005";

type BroadcastResult = {
  status?: string;
};

export async function POST(req: Request) {
  try {
    // `month` from the client is the rent month being checked (matches
    // the dashboard's month selector), not the payment month.
    const { month: rentMonth } = await req.json();

    const [tenants, payments] = await Promise.all([
      getSheetRows<Tenant>("tenants"),
      getSheetRows<Payment>("payments"),
    ]);

    const activeTenants = getActiveTenants(tenants, rentMonth);

    const unpaid = activeTenants.filter((t) => {
      const paymentStatus = evaluatePaymentStatus({
        tenant: t,
        payments,
        rentMonth,
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
