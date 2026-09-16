"use client";

import { CalendarX, CheckCircle2, TriangleAlert } from "lucide-react";

import Card from "@/components/ui/Card";
import LockedCard from "@/components/ui/LockedCard";
import ProgressBar from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/utils/currency";
import { formatMonthLabel } from "@/utils/date";
import type { MonthInsight } from "@/types/expense";

type Props = {
  month: MonthInsight;
  unlocked: boolean;
  onRequestUnlock: () => void;
};

/**
 * Whether this month's numbers can be trusted.
 *
 * Entry here is manual and slip-driven, so the failure mode is omission: a
 * whole category quietly missing makes every comparison on the other tabs
 * wrong. This tab is where that shows up instead of hiding.
 */
export default function ChecksTab({ month, unlocked, onRequestUnlock }: Props) {
  const label = formatMonthLabel(month.month);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Coverage
        </h2>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Days with at least one entry</span>
            <span className="font-semibold tabular-nums text-foreground">
              {month.daysWithEntries} of {month.daysElapsed}
            </span>
          </div>
          <ProgressBar
            percent={
              month.daysElapsed > 0
                ? (month.daysWithEntries / month.daysElapsed) * 100
                : 0
            }
          />
          <p className="flex items-center gap-2 text-sm text-muted">
            {month.longestGapDays > 2 ? (
              <>
                <CalendarX
                  className="h-4 w-4 shrink-0 text-warning"
                  aria-hidden="true"
                />
                Longest stretch with nothing logged: {month.longestGapDays}{" "}
                days. Worth checking for a slip you have not entered.
              </>
            ) : (
              <>
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                No long gaps in {label}.
              </>
            )}
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Usually logged, missing here
          </h2>
          <p className="text-sm text-muted">
            Things billed about once a month that showed up in recent months
            but not in {label}.
          </p>
        </div>

        {!unlocked ? (
          <LockedCard message="Enter the PIN to run this check." onUnlock={onRequestUnlock} />
        ) : month.missingRecurring.length === 0 ? (
          <Card className="flex items-center gap-3 p-5">
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-success"
              aria-hidden="true"
            />
            <p className="text-sm text-muted">
              Nothing regular looks missing from {label}.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {month.missingRecurring.map((gap) => (
              <div
                key={`${gap.category}-${gap.name}`}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <TriangleAlert
                    className="h-4 w-4 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-foreground">
                      {gap.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {gap.category} · {gap.monthsSeen} recent month
                      {gap.monthsSeen === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(gap.typicalAmount)}
                  </span>
                  <span className="block text-xs text-muted">typical</span>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
