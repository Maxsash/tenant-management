import type { ExpenseCategory, ExpenseItem } from "@/types/expense";

export const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
] as const;

export const DEFAULT_CATEGORY_ICON = "📦";

export function getCategoryIcon(
  categories: ExpenseCategory[],
  name: string
) {
  return categories.find((c) => c.name === name)?.icon ?? DEFAULT_CATEGORY_ICON;
}

export interface ItemsByCategory {
  category: string;
  icon: string;
  items: ExpenseItem[];
}

/**
 * Groups the item catalog by category, in category order, dropping any
 * category that has no items. Single source of truth so item-picker UIs
 * don't each re-implement the same grouping.
 */
export function groupItemsByCategory(
  categories: ExpenseCategory[],
  items: ExpenseItem[]
): ItemsByCategory[] {
  return categories
    .map((c) => ({
      category: c.name,
      icon: c.icon,
      items: items.filter((i) => i.category === c.name),
    }))
    .filter((group) => group.items.length > 0);
}
