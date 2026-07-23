import type { AdminLevel } from "@/types/admin";

export async function unlockAdminSession(pin: string): Promise<AdminLevel | null> {
  const res = await fetch("/api/admin-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.level ?? null;
}

export async function getAdminSessionStatus(): Promise<AdminLevel | null> {
  const res = await fetch("/api/admin-session");

  if (!res.ok) return null;

  const data = await res.json();
  return data.level ?? null;
}
