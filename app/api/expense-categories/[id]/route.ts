import {
  deleteExpenseCategory,
  getExpenseCategoryById,
  isExpenseCategoryInUse,
  updateExpenseCategory,
} from "@/lib/db";
import type { ExpenseCategory } from "@/types/expense";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, icon, sort_order, active } = await req.json();

  const updated = await updateExpenseCategory(id, {
    ...(name !== undefined && { name }),
    ...(icon !== undefined && { icon }),
    ...(sort_order !== undefined && { sort_order }),
    ...(active !== undefined && { active }),
  });

  return NextResponse.json({ category: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const category = await getExpenseCategoryById<ExpenseCategory>(id);

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const inUse = await isExpenseCategoryInUse(category.name);

  if (inUse) {
    return NextResponse.json(
      {
        error:
          "This category has items or expenses logged against it and can't be deleted. Deactivate it instead.",
      },
      { status: 400 }
    );
  }

  await deleteExpenseCategory(id);

  return NextResponse.json({ ok: true });
}
