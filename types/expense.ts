export type PaymentMethod = "Cash" | "UPI" | "Card" | "Bank Transfer";

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  active: boolean;
}

export interface ExpenseItem {
  id: string;
  name: string;
  category: string;
  default_unit?: string | null;
  active: boolean;
  created_at?: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  item_id?: string | null;
  item_name: string;
  category: string;
  quantity?: number | null;
  unit?: string | null;
  amount: number;
  payment_method: PaymentMethod | string;
  notes?: string | null;
  is_itemized: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  pct: number;
}

export interface ExpenseMonthData {
  month: string;
  total: number;
  categoryTotals: CategoryTotal[];
  // Empty (with unlocked: false) unless the caller has at least a
  // user-level session — see app/api/expenses/route.ts.
  expenses: Expense[];
  unlocked: boolean;
}
