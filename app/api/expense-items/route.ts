import { getExpenseItems, getExpenses, insertExpenseItem } from "@/lib/db";
import { hasAdminSession } from "@/lib/admin-auth";
import { currentDate } from "@/lib/date";
import { suggestItems } from "@/lib/expense-items";
import type { Expense, ExpenseItem } from "@/types/expense";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";
  // Costs a full expenses read, so the entry sheet asks for it and the
  // settings screens (which only list the catalogue) do not.
  const withSuggestions = searchParams.get("suggest") === "true";

  const items = await getExpenseItems<ExpenseItem>(all);

  if (!withSuggestions) {
    return NextResponse.json({ items });
  }

  const expenses = await getExpenses<Expense>();

  return NextResponse.json({
    items,
    suggested: suggestItems(items, expenses, currentDate()),
  });
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
