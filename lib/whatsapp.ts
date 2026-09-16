import { calculateRent } from "@/lib/rent";
import { getActiveTenants } from "@/lib/tenant";
import { evaluatePaymentStatus } from "@/lib/payment-status";
import type { Tenant } from "@/types/tenant";
import type { Payment } from "@/types/payment";
import type { WhatsAppMessageKind } from "@/types/whatsapp";

// Rent messages go out two ways: in bulk through whatsapp-worker when the
// laptop is running it, and as tap-to-send links from a phone anywhere.
// Both take their wording and recipient list from here, so the two paths
// cannot drift apart. The worker only delivers the text it is handed.

export type RentRecipient = {
  id: string;
  name: string;
  phone?: string;
  rent: number;
};

export function isWhatsAppMessageKind(value: unknown): value is WhatsAppMessageKind {
  return value === "reminder" || value === "greeting";
}

function toRecipient(tenant: Tenant, rentMonth: string): RentRecipient {
  return {
    id: tenant.id,
    name: tenant.name,
    phone: tenant.phone,
    rent: calculateRent(tenant, rentMonth),
  };
}

/** Active tenants whose rent for `rentMonth` is still pending. Tenants with
 *  no phone are kept — the caller decides whether to drop or flag them. */
export function getReminderRecipients(
  tenants: Tenant[],
  payments: Payment[],
  rentMonth: string
): RentRecipient[] {
  return getActiveTenants(tenants, rentMonth)
    .filter(
      (tenant) =>
        evaluatePaymentStatus({ tenant, payments, rentMonth }).status === "pending"
    )
    .map((tenant) => toRecipient(tenant, rentMonth));
}

/** Every tenant active in `rentMonth`, paid or not. */
export function getGreetingRecipients(tenants: Tenant[], rentMonth: string): RentRecipient[] {
  return getActiveTenants(tenants, rentMonth).map((tenant) => toRecipient(tenant, rentMonth));
}

/** "2026-08" -> "अगस्त". Built in UTC so the server's timezone can't roll it
 *  back a month. */
export function hindiMonthName(month: string): string {
  const [year, index] = month.split("-").map(Number);

  return new Date(Date.UTC(year, index - 1, 1)).toLocaleString("hi-IN", {
    month: "long",
    timeZone: "UTC",
  });
}

export function buildWhatsAppMessage(
  kind: WhatsAppMessageKind,
  rent: number,
  rentMonth: string
): string {
  const monthName = hindiMonthName(rentMonth);

  if (kind === "reminder") {
    return (
      "नमस्कार,\n\n" +
      "यह " + monthName + " माह के किराये ₹" + rent +
      " के संबंध में एक विनम्र स्मरण है। कृपया लंबित किराया शीघ्र जमा करने का कष्ट करें।\n\n" +
      "यदि भुगतान पहले ही किया जा चुका है, तो कृपया पुष्टि कर दें। अन्यथा कृपया इस संदेश को अनदेखा करें।\n\n" +
      "सादर।"
    );
  }

  return (
    "नमस्कार,\n\n" +
    "आपको " + monthName + " माह की हार्दिक शुभकामनाएँ। आशा है कि आप और आपका परिवार स्वस्थ एवं सुखी होंगे।\n\n" +
    monthName + " माह के लिए देय किराया ₹" + rent +
    " है। कृपया सुविधानुसार समय पर भुगतान करें।\n\n" +
    "आपके सहयोग हेतु धन्यवाद।\n\n" +
    "सादर।"
  );
}

/** Digits WhatsApp addresses an Indian number by ("919876543210"), or null.
 *  Same rules as whatsapp-worker's normalizePhone, so a number that works
 *  from the laptop also works from the phone, and vice versa. */
export function toWhatsAppNumber(phone: string | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;

  return null;
}

/** A link that opens a chat with `phone` and `message` already typed in,
 *  leaving only Send. wa.me rather than the whatsapp:// app scheme because it
 *  also works where the app isn't installed (WhatsApp Web on a laptop). */
export function buildWhatsAppLink(phone: string | undefined, message: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
