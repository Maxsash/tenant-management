export const EXPENSE_CATEGORIES = [
  "Dairy",
  "Vegetables & Fruits",
  "Groceries",
  "Utilities",
  "Household",
  "Household Help",
  "Subscriptions",
  "Transport",
  "Personal Care",
  "Other",
] as const;

export const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
] as const;

export const CATEGORY_ICONS: Record<string, string> = {
  Dairy: "🥛",
  "Vegetables & Fruits": "🥕",
  Groceries: "🛒",
  Utilities: "💡",
  Household: "🏠",
  "Household Help": "🧹",
  Subscriptions: "📺",
  Transport: "⛽",
  "Personal Care": "🧴",
  Other: "📦",
};

export function getCategoryIcon(category: string) {
  return CATEGORY_ICONS[category] ?? "📦";
}
