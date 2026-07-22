import type { ExpenseItem } from "@/types/expense";

export type ExpenseMode = "pick" | "custom" | "lump";

export interface DeriveExpenseFieldsInput {
  mode: ExpenseMode;
  item_id?: string | null;
  custom_name?: string | null;
  category?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  items: ExpenseItem[];
}

export interface DerivedExpenseFields {
  item_id: string | null;
  item_name: string;
  category: string;
  is_itemized: boolean;
  quantity: number | null;
  unit: string | null;
}

export type DeriveExpenseFieldsResult = DerivedExpenseFields | { error: string };

/**
 * Turns a raw client selection (mode + item_id/custom_name/category) into
 * the actual fields to persist for an expense, including the "(mixed)"
 * item_name synthesized for lump-sum entries. Single source of truth so the
 * classification rule lives in one place regardless of caller (create vs.
 * edit).
 */
export function deriveExpenseFields(
  input: DeriveExpenseFieldsInput
): DeriveExpenseFieldsResult {
  const quantity =
    input.quantity !== null && input.quantity !== undefined && input.quantity !== ""
      ? Number(input.quantity)
      : null;
  const unit = input.unit || null;

  if (input.mode === "pick") {
    const item = input.items.find((i) => i.id === input.item_id);

    if (!item) {
      return { error: "Pick an item, or switch to Other / Lump Sum" };
    }

    return {
      item_id: item.id,
      item_name: item.name,
      category: item.category,
      is_itemized: true,
      quantity,
      unit,
    };
  }

  if (input.mode === "custom") {
    const customName = input.custom_name?.trim();

    if (!customName) {
      return { error: "Enter an item name" };
    }

    if (!input.category) {
      return { error: "Pick a category" };
    }

    return {
      item_id: null,
      item_name: customName,
      category: input.category,
      is_itemized: true,
      quantity,
      unit,
    };
  }

  // mode === "lump"
  if (!input.category) {
    return { error: "Pick a category" };
  }

  return {
    item_id: null,
    item_name: `${input.category} (mixed)`,
    category: input.category,
    is_itemized: false,
    quantity: null,
    unit: null,
  };
}
