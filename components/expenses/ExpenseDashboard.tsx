"use client";

import Link from "next/link";
import { Plus, Settings } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import MonthPicker from "@/components/ui/MonthPicker";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import PageContainer from "@/components/ui/PageContainer";
import ExpenseEntryRow from "./ExpenseEntryRow";
import { formatCurrency } from "@/utils/currency";
import { getCategoryIcon } from "@/lib/expense-categories";
import type { Expense, ExpenseCategory, ExpenseMonthData } from "@/types/expense";

type Props = {
  data: ExpenseMonthData | null;
  month: string;
  onMonthChange: (month: string) => void;
  loading: boolean;
  adminEnabled: boolean;
  categories: ExpenseCategory[];
  onAdd: () => void;
  onEditEntry: (expense: Expense) => void;
};

export default function ExpenseDashboard({
  data,
  month,
  onMonthChange,
  loading,
  adminEnabled,
  categories,
  onAdd,
  onEditEntry,
}: Props) {
  const total = data?.total ?? 0;
  const categoryTotals = data?.categoryTotals ?? [];
  const expenses = data?.expenses ?? [];

  return (
    <PageContainer size="lg">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-3xl font-semibold text-foreground">Expenses</h1>

        <div className="flex items-center gap-3">
          <MonthPicker value={month} onChange={onMonthChange} className="flex-1 md:w-56" />

          {adminEnabled && (
            <Link
              href="/expense/settings"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      <Card className="p-5 text-center">
        <p className="text-sm font-medium text-muted">Total this month</p>
        <p className="mt-1 font-display text-[36px] font-semibold text-foreground">
          {formatCurrency(total)}
        </p>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          {categoryTotals.length > 0 && (
            <Card className="flex flex-col gap-4 p-5">
              {categoryTotals.map((c) => (
                <div key={c.category} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {getCategoryIcon(categories, c.category)} {c.category}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(c.amount)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-500"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </Card>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold text-foreground">Entries</h2>

            {expenses.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                description="Nothing logged for this month yet."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {expenses.map((expense) => (
                  <ExpenseEntryRow
                    key={expense.id}
                    expense={expense}
                    categories={categories}
                    onClick={adminEnabled ? () => onEditEntry(expense) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {adminEnabled && (
        <Button
          size="lg"
          onClick={onAdd}
          aria-label="Add expense"
          className="fixed right-5 bottom-28 z-30 w-14 !p-0 rounded-full shadow-float md:right-10 md:bottom-10"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </PageContainer>
  );
}
