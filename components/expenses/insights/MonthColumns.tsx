"use client";

import { formatCompactCurrency, formatCurrency } from "@/utils/currency";
import { formatMonthShort } from "@/utils/date";
import { cn } from "@/utils/cn";
import type { MonthInsight } from "@/types/expense";

type Props = {
  months: MonthInsight[];
  selectedMonth: string;
  onSelect: (month: string) => void;
};

const PLOT_HEIGHT = 132;

/**
 * Monthly spend, one column per month. A single series, so it wears one hue
 * and uses emphasis rather than colour-coding: the focused month is solid
 * accent and the rest recede, which keeps the reader on the month they picked.
 *
 * Columns are the month selector for the whole screen — tapping one refocuses
 * every card below without a refetch.
 */
export default function MonthColumns({
  months,
  selectedMonth,
  onSelect,
}: Props) {
  const max = Math.max(...months.map((m) => m.total), 0);

  return (
    <div>
      <div
        className="flex items-end gap-1.5"
        style={{ height: PLOT_HEIGHT }}
        role="group"
        aria-label="Monthly spend"
      >
        {months.map((month) => {
          const selected = month.month === selectedMonth;
          const height = max > 0 ? Math.max((month.total / max) * 100, 2) : 2;

          return (
            <button
              key={month.month}
              type="button"
              onClick={() => onSelect(month.month)}
              aria-pressed={selected}
              aria-label={`${formatMonthShort(month.month)}, ${formatCurrency(
                month.total
              )}`}
              // The whole column is the hit target, not just the drawn bar.
              className="group flex h-full flex-1 flex-col justify-end rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span
                className={cn(
                  "mb-1.5 text-center text-[11px] font-semibold tabular-nums transition-colors",
                  selected ? "text-foreground" : "text-transparent"
                )}
              >
                {formatCompactCurrency(month.total)}
              </span>
              <span
                style={{ height: `${height}%` }}
                className={cn(
                  // Capped width with the slot's leftover left as air, and a
                  // rounded data-end that stays square on the baseline.
                  "mx-auto w-full max-w-6 rounded-t transition-colors",
                  selected ? "bg-accent" : "bg-accent/25 group-hover:bg-accent/40"
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-0 h-px bg-border" />

      <div className="flex gap-1.5 pt-2">
        {months.map((month) => (
          <span
            key={month.month}
            className={cn(
              "flex-1 text-center text-[11px] font-medium",
              month.month === selectedMonth ? "text-foreground" : "text-muted"
            )}
          >
            {formatMonthShort(month.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
