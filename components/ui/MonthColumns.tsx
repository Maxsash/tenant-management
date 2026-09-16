"use client";

import { formatCompactCurrency, formatCurrency } from "@/utils/currency";
import { formatMonthShort, formatMonthShortYear } from "@/utils/date";
import { cn } from "@/utils/cn";

export type MonthColumn = {
  month: string;
  /** Null draws no bar — a month with no reading, not a month of zero. */
  value: number | null;
  /** When given, the column is drawn to this height and `value` fills it from
   *  the bottom, like a meter: collected out of what was due. */
  total?: number;
};

type Props = {
  columns: MonthColumn[];
  selectedMonth: string;
  onSelect: (month: string) => void;
  ariaLabel: string;
  formatValue?: (value: number) => string;
  /** What a screen reader hears for one column. */
  describe?: (column: MonthColumn) => string;
  /** Fixed top of the scale, e.g. 100 for percentages. Defaults to the
   *  largest column. */
  max?: number;
  height?: number;
};

/** Past this many columns, labelling every month runs the labels together.
 *  Labels carrying a year are twice as wide, so fewer of them fit. */
const MAX_LABELS = 12;
const MAX_LABELS_WITH_YEAR = 6;

/**
 * One column per month, and the month selector for the screen it sits on:
 * tapping a column refocuses everything below without a refetch.
 *
 * A single series, so it wears one hue and uses emphasis rather than colour
 * coding — the focused month is solid accent and the rest recede.
 *
 * As a meter, the unfilled part of each column is a lighter step of the same
 * hue, set off from the fill by a 2px gap rather than a border. There the
 * other months can't recede by fading: a faded fill looks exactly like the
 * unfilled part, and "collected" would read as "not collected". So every
 * column keeps its true colours and the focused one is marked by its slot,
 * its value and its label instead.
 */
export default function MonthColumns({
  columns,
  selectedMonth,
  onSelect,
  ariaLabel,
  formatValue = formatCompactCurrency,
  describe = (c) => `${formatMonthShort(c.month)}, ${formatCurrency(c.value ?? 0)}`,
  max: fixedMax,
  height = 132,
}: Props) {
  const max =
    fixedMax ?? Math.max(...columns.map((c) => c.total ?? c.value ?? 0), 0);

  // Label every Nth month, counted back from the newest so it is always named.
  const showYear = columns.length > MAX_LABELS;
  const step = Math.ceil(
    columns.length / (showYear ? MAX_LABELS_WITH_YEAR : MAX_LABELS)
  );
  const labelled = (i: number) => (columns.length - 1 - i) % step === 0;
  const meter = columns.some((c) => c.total !== undefined);

  return (
    <div>
      <div
        className="flex items-end gap-1.5"
        style={{ height }}
        role="group"
        aria-label={ariaLabel}
      >
        {columns.map((column) => {
          const selected = column.month === selectedMonth;
          const value = column.value ?? 0;
          const outer = column.total ?? value;
          const columnHeight =
            max > 0 && column.value !== null ? Math.max((outer / max) * 100, 2) : 0;
          const filled = outer > 0 ? Math.min(value / outer, 1) : 1;

          return (
            <button
              key={column.month}
              type="button"
              onClick={() => onSelect(column.month)}
              aria-pressed={selected}
              aria-label={describe(column)}
              // The whole column is the hit target, not just the drawn bar.
              className={cn(
                "group flex h-full min-w-0 flex-1 flex-col justify-end rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                meter && selected && "bg-foreground/[0.08]"
              )}
            >
              <span
                className={cn(
                  // Flex-centred so a label wider than a thin column spills evenly
                  // both ways instead of off to the right.
                  "mb-1.5 flex justify-center text-[11px] font-semibold whitespace-nowrap tabular-nums transition-colors",
                  selected ? "text-foreground" : "text-transparent"
                )}
              >
                {column.value === null ? "–" : formatValue(value)}
              </span>
              <span
                style={{ height: `${columnHeight}%` }}
                // Capped width with the slot's leftover left as air.
                className="mx-auto flex w-full max-w-6 flex-col gap-0.5"
              >
                {filled < 1 && (
                  <span
                    style={{ flexGrow: 1 - filled }}
                    className={cn(
                      "min-h-0.5 basis-0 rounded-t bg-accent/15 transition-colors"
                    )}
                  />
                )}
                {filled > 0 && (
                  <span
                    style={{ flexGrow: filled }}
                    className={cn(
                      // Rounded at the data end, square on the baseline.
                      "min-h-0.5 basis-0 transition-colors",
                      filled === 1 && "rounded-t",
                      selected || meter
                        ? "bg-accent"
                        : "bg-accent/25 group-hover:bg-accent/40"
                    )}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-0 h-px bg-border" />

      <div className="flex gap-1.5 pt-2" aria-hidden="true">
        {columns.map((column, i) => (
          <span
            key={column.month}
            className={cn(
              "flex min-w-0 flex-1 justify-center text-[11px] font-medium whitespace-nowrap",
              column.month === selectedMonth ? "font-bold text-foreground" : "text-muted",
              // Forcing the focused month's label in between labelled ones
              // would collide with them; the card's heading names it anyway.
              !labelled(i) && "invisible"
            )}
          >
            {showYear ? formatMonthShortYear(column.month) : formatMonthShort(column.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
