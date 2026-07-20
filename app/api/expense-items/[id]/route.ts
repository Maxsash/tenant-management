import {
  deleteExpenseItem,
  isExpenseItemInUse,
  updateExpenseItem,
} from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, category, default_unit, active } = await req.json();

  const updated = await updateExpenseItem(id, {
    ...(name !== undefined && { name }),
    ...(category !== undefined && { category }),
    ...(default_unit !== undefined && { default_unit }),
    ...(active !== undefined && { active }),
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const inUse = await isExpenseItemInUse(id);

  if (inUse) {
    return NextResponse.json(
      {
        error:
          "This item has expense history and can't be deleted. Deactivate it instead.",
      },
      { status: 400 }
    );
  }

  await deleteExpenseItem(id);

  return NextResponse.json({ ok: true });
}
