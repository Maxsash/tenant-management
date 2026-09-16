"use client";

import Link from "next/link";
import { Camera, Plus, Settings } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LockedCard from "@/components/ui/LockedCard";
import MonthPicker from "@/components/ui/MonthPicker";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import SeaScene from "@/components/ui/sea/SeaScene";
import ProgressBar from "@/components/ui/ProgressBar";
import ExpenseEntryRow from "./ExpenseEntryRow";
import ExpenseSectionNav from "./ExpenseSectionNav";
import { formatCurrency } from "@/utils/currency";
import { getCategoryIcon } from "@/lib/expense-categories";
import type { Expense, ExpenseCategory, ExpenseMonthData } from "@/types/expense";

type Props = {
  data: ExpenseMonthData | null;
  month: string;
  onMonthChange: (month: string) => void;
  loading: boolean;
  categories: ExpenseCategory[];
  onAdd: () => void;
  onScan: () => void;
  onEditEntry: (expense: Expense) => void;
  onRequestUnlock: () => void;
};

export default function ExpenseDashboard({
  data,
  month,
  onMonthChange,
  loading,
  categories,
  onAdd,
  onScan,
  onEditEntry,
  onRequestUnlock,
}: Props) {
  const total = data?.total ?? 0;
  const categoryTotals = data?.categoryTotals ?? [];
  const expenses = data?.expenses ?? [];

  return (
    <PageContainer size="lg">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Ship's log" title="Expenses">
          <ExpenseSectionNav className="md:w-64" />
        </PageHeader>

        <div className="flex items-center gap-3">
          <MonthPicker value={month} onChange={onMonthChange} className="flex-1 md:w-56" />

          <Link
            href="/expense/settings"
            aria-label="Expense settings"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* The month's total, written in the sky above the harbour. */}
      <Card className="relative isolate h-52 overflow-hidden">
        <SeaScene className="absolute inset-0 -z-10" shore="var(--color-surface)" />
        <div className="p-6">
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-foreground/75 uppercase">
            Total this month
          </p>
          <p className="mt-1 font-display text-[40px] leading-tight font-semibold text-foreground tabular-nums">
            {formatCurrency(total)}
          </p>
        </div>
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
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(c.amount)}
                    </span>
                  </div>
                  <ProgressBar percent={c.pct} />
                </div>
              ))}
            </Card>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-semibold text-foreground">Entries</h2>

            {!data?.unlocked ? (
              <LockedCard message="Enter the PIN to view expense entries." onUnlock={onRequestUnlock} />
            ) : expenses.length === 0 ? (
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
                    onClick={() => onEditEntry(expense)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Two ways in, stacked in the thumb's reach. The camera sits above the
          plus because a photographed slip is the usual way expenses arrive
          here — one tap from opening the app, rather than buried inside the
          entry sheet. */}
      <div className="fixed right-5 bottom-28 z-30 flex flex-col items-center gap-3 md:right-10 md:bottom-10">
        <Button
          variant="outline"
          onClick={onScan}
          aria-label="Scan a slip"
          className="h-12 w-12 !p-0 shadow-float"
        >
          <Camera className="h-5 w-5 text-accent" />
        </Button>

        <Button
          size="lg"
          onClick={onAdd}
          aria-label="Add expense"
          className="w-14 !p-0 shadow-float ring-4 ring-surface/80"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </PageContainer>
  );
}
