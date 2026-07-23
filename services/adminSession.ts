export async function unlockAdminSession(pin: string): Promise<boolean> {
  const res = await fetch("/api/admin-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  return res.ok;
}

export async function getAdminSessionStatus(): Promise<boolean> {
  const res = await fetch("/api/admin-session");

  if (!res.ok) return false;

  const data = await res.json();
  return Boolean(data.unlocked);
}
