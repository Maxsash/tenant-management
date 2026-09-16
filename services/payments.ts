async function sendPaidOn(
  method: "POST" | "PATCH",
  tenantId: string,
  month: string,
  paidOn: string,
  fallbackError: string
) {
  const res = await fetch("/api/mark-paid", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantId, month, paid_on: paidOn }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || fallbackError);
  }

  return data;
}

/** `month` is the rent month, as on the dashboard. */
export function markRentPaid(tenantId: string, month: string, paidOn: string) {
  return sendPaidOn("POST", tenantId, month, paidOn, "Failed to mark as paid");
}

/** `month` is the rent month, as on the dashboard. */
export function changePaidOnDate(tenantId: string, month: string, paidOn: string) {
  return sendPaidOn("PATCH", tenantId, month, paidOn, "Failed to change the payment date");
}
