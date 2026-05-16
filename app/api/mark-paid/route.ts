import { getSheetRows, appendSheetRow } from "@/lib/sheets";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { tenant_id, month, paid_on } = await req.json();

  // Check if row already exists
  const payments = await getSheetRows("payments");
  const exists = payments.find(
    (p) => p.tenant_id === tenant_id && p.month === month
  );

  if (exists) {
    return NextResponse.json({ error: "Already marked paid" }, { status: 400 });
  }

  await appendSheetRow("payments", [tenant_id, month, paid_on, ""]);
  return NextResponse.json({ ok: true });
}