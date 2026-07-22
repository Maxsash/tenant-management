import type { Expense, ExpenseCategory, ExpenseItem } from "@/types/expense";

export function makeExpenseCategory(
  overrides: Partial<ExpenseCategory> = {}
): ExpenseCategory {
  return {
    id: "category-1",
    name: "Groceries",
    icon: "🛒",
    sort_order: 0,
    active: true,
    ...overrides,
  };
}

export function makeExpenseItem(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    id: "item-1",
    name: "Milk",
    category: "Groceries",
    default_unit: "L",
    active: true,
    ...overrides,
  };
}

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-1",
    expense_date: "2026-07-15",
    item_id: "item-1",
    item_name: "Milk",
    category: "Groceries",
    quantity: 1,
    unit: "L",
    amount: 60,
    payment_method: "UPI",
    is_itemized: true,
    ...overrides,
  };
}
