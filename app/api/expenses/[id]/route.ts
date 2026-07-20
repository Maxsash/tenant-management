import { deleteExpense, updateExpense } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  } = body;

  const updated = await updateExpense(id, {
    ...(expense_date !== undefined && { expense_date }),
    ...(item_id !== undefined && { item_id }),
    ...(item_name !== undefined && { item_name }),
    ...(category !== undefined && { category }),
    ...(quantity !== undefined && { quantity }),
    ...(unit !== undefined && { unit }),
    ...(amount !== undefined && { amount: Number(amount) }),
    ...(payment_method !== undefined && { payment_method }),
    ...(notes !== undefined && { notes }),
  });

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
