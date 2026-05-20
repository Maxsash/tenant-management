export async function sendMonthlyGreeting(month: string) {
  const res = await fetch("/api/monthly-greeting", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ month }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Monthly greeting failed");
  }

  return data;
}