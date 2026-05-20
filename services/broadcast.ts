export async function sendBroadcast(month: string) {
  const res = await fetch("/api/broadcast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ month }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Broadcast failed");
  }

  return data;
}