// "reminder" goes to active tenants whose rent is still pending for the
// month; "greeting" goes to every active tenant. See lib/whatsapp.ts.
export type WhatsAppMessageKind = "reminder" | "greeting";

// One tap-to-send row. `link` is null when the tenant has no phone number
// WhatsApp could use, so the row can say so instead of silently vanishing.
export type WhatsAppLink = {
  id: string;
  name: string;
  rent: number;
  link: string | null;
};

export type WhatsAppLinksResponse = {
  rent_month: string;
  kind: WhatsAppMessageKind;
  recipients: WhatsAppLink[];
};
