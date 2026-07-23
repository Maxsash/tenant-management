import { getExpenseCategories, insertExpenseCategory } from "@/lib/db";
import { hasAdminSession } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  const categories = await getExpenseCategories(all);

  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const { name, icon, sort_order } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const created = await insertExpenseCategory({
    name,
    icon: icon || "📦",
    sort_order,
  });

  return NextResponse.json({ category: created });
}
