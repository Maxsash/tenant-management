"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import StatTile from "@/components/ui/StatTile";
import DeltaChip from "./DeltaChip";
import { formatCompactCurrency, formatCurrency } from "@/utils/currency";
import { getCategoryIcon } from "@/lib/expense-categories";
import type {
  CategorySeries,
  ExpenseCategory,
  MonthInsight,
} from "@/types/expense";

type Props = {
  month: MonthInsight;
  monthIndex: number;
  categories: CategorySeries[];
  categoryIcons: ExpenseCategory[];
  unlocked: boolean;
  onRequestUnlock: () => void;
};

const COLLAPSED_CATEGORIES = 6;

export default function SpendingTab({
  month,
  monthIndex,
  categories,
  categoryIcons,
  unlocked,
  onRequestUnlock,
}: Props) {
  const [showAllCategories, setShowAllCategories] = useState(false);

  const present = categories
    .map((c) => ({
      category: c.category,
      amount: c.amounts[monthIndex] ?? 0,
      deltaPct: c.deltaPcts[monthIndex] ?? null,
    }))
    .filter((c) => c.amount > 0);

  // Bars are scaled against the biggest category so the smallest ones stay
  // visible; the exact figure is printed beside every bar regardless.
  const widest = Math.max(...present.map((c) => c.amount), 0);
  const visible = showAllCategories
    ? present
    : present.slice(0, COLLAPSED_CATEGORIES);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Per day"
          value={formatCompactCurrency(month.avgPerDay)}
          helper={
            month.isCurrentMonth
              ? `over ${month.daysElapsed} days so far`
              : `over ${month.daysInMonth} days`
          }
        />
        {month.projectedTotal !== null ? (
          <StatTile
            label="On track for"
            value={formatCompactCurrency(month.projectedTotal)}
            helper="if the rest of the month matches"
          />
        ) : (
          <StatTile
            label="Days logged"
            value={`${month.daysWithEntries}/${month.daysElapsed}`}
            helper={
              month.longestGapDays > 0
                ? `longest quiet run ${month.longestGapDays} days`
                : "every day covered"
            }
          />
        )}
        <StatTile
          label="Entries"
          value={month.entryCount}
          helper="rows logged this month"
          // Odd tile out on a 2-column phone: let it run the full width.
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Where it went
        </h2>

        {present.length === 0 ? (
          <Card className="p-5 text-sm text-muted">
            Nothing logged for this month.
          </Card>
        ) : (
          <Card className="flex flex-col gap-4 p-5">
            {visible.map((c) => (
              <div key={c.category} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {getCategoryIcon(categoryIcons, c.category)} {c.category}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <DeltaChip deltaPct={c.deltaPct} />
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(c.amount)}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{
                      width: `${widest > 0 ? (c.amount / widest) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            {present.length > COLLAPSED_CATEGORIES && (
              <button
                type="button"
                onClick={() => setShowAllCategories((v) => !v)}
                className="self-start text-sm font-semibold text-accent"
              >
                {showAllCategories
                  ? "Show fewer"
                  : `Show all ${present.length} categories`}
              </button>
            )}
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Biggest single items
        </h2>

        {!unlocked ? (
          <Card className="flex flex-col items-center gap-3 p-6 text-center">
            <Lock className="h-5 w-5 text-muted" aria-hidden="true" />
            <p className="text-sm text-muted">
              Enter the PIN to see item-level detail.
            </p>
            <Button variant="outline" onClick={onRequestUnlock}>
              Unlock
            </Button>
          </Card>
        ) : month.topItems.length === 0 ? (
          <Card className="p-5 text-sm text-muted">
            No itemised entries this month.
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {month.topItems.map((item) => (
              <div
                key={`${item.category}-${item.name}`}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {item.category}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
