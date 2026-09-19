import type { AdminLevel } from "@/types/admin";

// Client-module cache: shared by every useAdminUnlock instance for as long as
// the current app page is alive. The HttpOnly cookie remains the authority;
// this only avoids asking the server the same question after client-side
// navigation. A full reload starts with an empty cache and verifies once.
let cachedSessionLevel: AdminLevel | null | undefined;
let sessionStatusRequest: Promise<AdminLevel | null> | null = null;

export function getCachedAdminSessionStatus():
  | AdminLevel
  | null
  | undefined {
  return cachedSessionLevel;
}

export async function unlockAdminSession(pin: string): Promise<AdminLevel | null> {
  const res = await fetch("/api/admin-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const level = data.level ?? null;
  cachedSessionLevel = level;
  return level;
}

export function getAdminSessionStatus(): Promise<AdminLevel | null> {
  if (cachedSessionLevel !== undefined) {
    return Promise.resolve(cachedSessionLevel);
  }

  // Several page components can mount during one navigation. Share the same
  // in-flight check instead of sending one request per hook instance.
  if (sessionStatusRequest) return sessionStatusRequest;

  sessionStatusRequest = (async () => {
    try {
      const res = await fetch("/api/admin-session");

      if (!res.ok) {
        cachedSessionLevel = null;
        return null;
      }

      const data = await res.json();
      const level = data.level ?? null;
      cachedSessionLevel = level;
      return level;
    } finally {
      sessionStatusRequest = null;
    }
  })();

  return sessionStatusRequest;
}
