import { getExpenseCategories, getExpenses } from "@/lib/db";
import { buildExpenseAnalytics } from "@/lib/expense-analytics";
import { currentDate } from "@/lib/date";
import { hasUserSession } from "@/lib/admin-auth";
import type { Expense, ExpenseCategory } from "@/types/expense";
import { NextResponse } from "next/server";

export const DEFAULT_WINDOW_MONTHS = 6;
export const MAX_WINDOW_MONTHS = 24;

/**
 * Everything the insights screen needs, in one response, already derived.
 *
 * The whole window comes back at once so switching the focused month on the
 * client is instant and needs no refetch — and so no derivation leaks into the
 * component, which stays fetch-and-render.
 *
 * Like GET /api/expenses, headline totals are open and the line-item detail
 * (items, buy-again rhythms, consumption, price moves, recurring gaps) needs
 * a user-level session; `unlocked` tells the client which it got.
 *
 * The category catalogue is read only for its order, which the Need again tab
 * groups by. Losing it costs nothing but that order, so it cannot fail the
 * response.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requested = Number(searchParams.get("months"));
  const windowMonths =
    Number.isFinite(requested) && requested >= 1
      ? Math.min(Math.floor(requested), MAX_WINDOW_MONTHS)
      : DEFAULT_WINDOW_MONTHS;

  try {
    const [expenses, categories] = await Promise.all([
      getExpenses<Expense>(),
      getExpenseCategories<ExpenseCategory>(true).catch((err) => {
        console.error("Expense categories for analytics failed:", err);
        return [] as ExpenseCategory[];
      }),
    ]);

    return NextResponse.json(
      buildExpenseAnalytics(expenses, {
        today: currentDate(),
        windowMonths,
        unlocked: hasUserSession(req),
        categoryOrder: categories.map((category) => category.name),
      })
    );
  } catch (err) {
    console.error("Expense analytics failed:", err);
    return NextResponse.json(
      { error: "Failed to build expense analytics" },
      { status: 500 }
    );
  }
}
