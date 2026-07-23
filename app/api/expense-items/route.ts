import { getExpenseItems, insertExpenseItem } from "@/lib/db";
import { hasAdminSession } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  const items = await getExpenseItems(all);

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const { name, category, default_unit } = await req.json();

  if (!name?.trim() || !category?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const created = await insertExpenseItem({
    name,
    category,
    default_unit: default_unit ?? null,
  });

  return NextResponse.json({ item: created });
}
