// services/broadcast.ts

export async function sendBroadcast(
  month: string
) {
  const res = await fetch(
    "/api/broadcast",
    {
      method: "POST",
      body: JSON.stringify({ month }),
      headers: {
        "Content-Type":
          "application/json",
        "x-api-secret":
          process.env
            .NEXT_PUBLIC_API_SECRET!,
      },
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.error || "Broadcast failed"
    );
  }

  return data;
}