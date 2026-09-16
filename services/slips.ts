import type { SlipDraft } from "@/types/slip";

/**
 * Sends every photo of one handwritten slip to be read together, in the order
 * given. Everything about what the answer means is decided server-side; this
 * is just the transport, plus putting its failures into words.
 */
export async function scanSlip(photos: File[]): Promise<SlipDraft> {
  const body = new FormData();

  for (const photo of photos) body.append("image", photo);

  let res: Response;

  try {
    res = await fetch("/api/slip-scan", { method: "POST", body });
  } catch {
    // The request never got an answer. Safari words this as "Load failed",
    // which tells the person holding the phone nothing they can act on.
    throw new Error(
      "The connection dropped before the slip was read. Keep the app open, check the signal, and try again."
    );
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);

    throw new Error(payload?.error ?? describeFailedStatus(res.status));
  }

  const { draft } = await res.json();

  return draft as SlipDraft;
}

/**
 * For a failure that came back without the route's own JSON — the host
 * refusing the upload or timing out before the route could answer.
 */
function describeFailedStatus(status: number): string {
  if (status === 413) {
    return "Those photos are too large to send together. Remove one and try again.";
  }

  if (status === 504) {
    return "Reading the slip took too long. Try again in a minute.";
  }

  return "Could not read that slip";
}
