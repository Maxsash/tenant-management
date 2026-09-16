import type { WhatsAppLinksResponse, WhatsAppMessageKind } from "@/types/whatsapp";

export async function getWhatsAppLinks(
  month: string,
  kind: WhatsAppMessageKind
): Promise<WhatsAppLinksResponse> {
  const params = new URLSearchParams({ month, kind });
  const res = await fetch(`/api/whatsapp-links?${params}`);

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Could not load WhatsApp messages");
  }

  return data;
}
