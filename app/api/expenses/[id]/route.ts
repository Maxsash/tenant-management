import { deleteExpense, getExpenseItems, updateExpense } from "@/lib/db";
import { deriveExpenseFields, type ExpenseMode } from "@/lib/expenses";
import type { ExpenseItem } from "@/types/expense";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const patch: Record<string, unknown> = {
    ...(expense_date !== undefined && { expense_date }),
    ...(payment_method !== undefined && { payment_method }),
    ...(notes !== undefined && { notes }),
  };

  if (amount !== undefined) {
    const numericAmount = Number(amount);

    if (!(numericAmount > 0)) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    patch.amount = numericAmount;
  }

  if (mode !== undefined) {
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

    Object.assign(patch, derived);
  }

  const updated = await updateExpense(id, patch);

  return NextResponse.json({ expense: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await deleteExpense(id);

  return NextResponse.json({ ok: true });
}
