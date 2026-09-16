import { getTenants, getPayments } from "@/lib/db";
import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { isValidMonth } from "@/lib/date";
import {
  buildWhatsAppLink,
  buildWhatsAppMessage,
  getGreetingRecipients,
  getReminderRecipients,
  isWhatsAppMessageKind,
} from "@/lib/whatsapp";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";
import type { WhatsAppLinksResponse } from "@/types/whatsapp";

// The phone-friendly twin of /api/broadcast and /api/monthly-greeting: same
// recipients, same wording, but instead of sending through whatsapp-worker it
// returns one prefilled WhatsApp link per tenant, for the admin to tap and send
// from their own phone. Needs no worker, so it works from production.
export async function GET(req: Request) {
  // Admin tier, like the bulk send routes: the response carries every
  // recipient's phone number inside its link.
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    // Rent month, matching the dashboard's month selector.
    const rentMonth = searchParams.get("month");
    const kind = searchParams.get("kind");

    if (!isValidMonth(rentMonth)) {
      return NextResponse.json({ error: "Invalid month. Expected YYYY-MM" }, { status: 400 });
    }

    if (!isWhatsAppMessageKind(kind)) {
      return NextResponse.json(
        { error: "Invalid kind. Expected reminder or greeting" },
        { status: 400 }
      );
    }

    const [tenants, payments] = await Promise.all([
      getTenants<Tenant>(),
      getPayments<Payment>(),
    ]);

    const recipients =
      kind === "reminder"
        ? getReminderRecipients(tenants, payments, rentMonth)
        : getGreetingRecipients(tenants, rentMonth);

    const body: WhatsAppLinksResponse = {
      rent_month: rentMonth,
      kind,
      recipients: recipients.map((r) => ({
        id: r.id,
        name: r.name,
        rent: r.rent,
        link: buildWhatsAppLink(r.phone, buildWhatsAppMessage(kind, r.rent, rentMonth)),
      })),
    };

    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
