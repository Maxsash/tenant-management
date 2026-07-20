import type { ExpenseCategory } from "@/types/expense";

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
