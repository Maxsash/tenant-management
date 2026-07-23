import { getExpenseItems, getExpenses, insertExpense } from "@/lib/db";
import { buildExpenseSummary } from "@/lib/expense-summary";
import { deriveExpenseFields, type ExpenseMode } from "@/lib/expenses";
import { currentMonth } from "@/lib/date";
import { hasUserSession } from "@/lib/admin-auth";
import type { Expense, ExpenseItem } from "@/types/expense";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? currentMonth();
  const unlocked = hasUserSession(req);

  const allExpenses = await getExpenses<Expense>();
  const expenses = allExpenses.filter((e) =>
    e.expense_date.startsWith(month)
  );

  // Totals are aggregated over every expense regardless of lock state —
  // only the linewise entries themselves are sensitive/gated.
  const { total, categoryTotals } = buildExpenseSummary(expenses);

  return NextResponse.json({
    month,
    total,
    categoryTotals,
    expenses: unlocked ? expenses : [],
    unlocked,
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const {
    expense_date,
    mode,
    item_id,
    custom_name,
    category,
    quantity,
    unit,
    amount,
    payment_method,
    notes,
  } = body;

  const numericAmount = Number(amount);

  if (!expense_date || !payment_method || !(numericAmount > 0)) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const items: ExpenseItem[] =
    mode === "pick" ? await getExpenseItems<ExpenseItem>() : [];

  const derived = deriveExpenseFields({
    mode: mode as ExpenseMode,
    item_id,
    custom_name,
    category,
    quantity,
    unit,
    items,
  });

  if ("error" in derived) {
    return NextResponse.json({ error: derived.error }, { status: 400 });
  }

  const created = await insertExpense({
    expense_date,
    item_id: derived.item_id,
    item_name: derived.item_name,
    category: derived.category,
    quantity: derived.quantity,
    unit: derived.unit,
    amount: numericAmount,
    payment_method,
    notes: notes ?? null,
    is_itemized: derived.is_itemized,
  });

  return NextResponse.json({ expense: created });
}
