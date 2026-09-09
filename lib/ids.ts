let counter = 0;

/**
 * A key for a client-side list row. Never persisted — the database assigns
 * the real id.
 *
 * `crypto.randomUUID` only exists in a secure context, and this app is opened
 * from phones over the house LAN on plain http (the dev server prints that
 * address on startup). Reaching for it unguarded would throw on exactly the
 * devices this is built for, so it is used when present and a good-enough
 * local counter stands in when it is not.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  counter += 1;

  return `line-${Date.now().toString(36)}-${counter}`;
}
