import { getExpenses, insertExpense } from "@/lib/db";
import { buildExpenseSummary } from "@/lib/expense-summary";
import type { Expense } from "@/types/expense";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? currentMonth();

  const allExpenses = await getExpenses<Expense>();
  const expenses = allExpenses.filter((e) =>
    e.expense_date.startsWith(month)
  );

  const { total, categoryTotals } = buildExpenseSummary(expenses);

  return NextResponse.json({
    month,
    total,
    categoryTotals,
    expenses,
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const {
    expense_date,
    item_id,
    item_name,
    category,
    quantity,
    unit,
    amount,
    payment_method,
    notes,
    is_itemized,
  } = body;

  if (!expense_date || !item_name || !category || !amount || !payment_method) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const created = await insertExpense({
    expense_date,
    item_id: item_id ?? null,
    item_name,
    category,
    quantity: quantity ?? null,
    unit: unit ?? null,
    amount: Number(amount),
    payment_method,
    notes: notes ?? null,
    is_itemized: is_itemized ?? true,
  });

  return NextResponse.json({ expense: created });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
