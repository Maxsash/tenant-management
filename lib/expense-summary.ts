import type { CategoryTotal, Expense } from "@/types/expense";

export interface ExpenseSummary {
  total: number;
  categoryTotals: CategoryTotal[];
}

/**
 * Single source of truth for expense totals so every route/component
 * derives the same numbers instead of re-summing inline.
 */
export function buildExpenseSummary(expenses: Expense[]): ExpenseSummary {
  const totalsByCategory = new Map<string, number>();
  let total = 0;

  for (const expense of expenses) {
    const amount = Number(expense.amount) || 0;
    total += amount;

    totalsByCategory.set(
      expense.category,
      (totalsByCategory.get(expense.category) ?? 0) + amount
    );
  }

  const categoryTotals: CategoryTotal[] = Array.from(
    totalsByCategory.entries()
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { total, categoryTotals };
}
