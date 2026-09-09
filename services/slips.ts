import type { SlipDraft } from "@/types/slip";

/**
 * Sends one photo of a handwritten slip to be read. Everything about what the
 * answer means is decided server-side; this is just the transport.
 */
export async function scanSlip(file: File): Promise<SlipDraft> {
  const body = new FormData();
  body.set("image", file);

  const res = await fetch("/api/slip-scan", { method: "POST", body });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));

    throw new Error(payload.error ?? "Could not read that slip");
  }

  const { draft } = await res.json();

  return draft as SlipDraft;
}
