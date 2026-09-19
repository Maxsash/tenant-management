"use client";

import { CalendarDays, History, ShoppingBag } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import ProgressBar from "@/components/ui/ProgressBar";
import StatTile from "@/components/ui/StatTile";
import { getCategoryIcon } from "@/lib/expense-categories";
import type {
  ExpenseCategory,
  PurchaseLearningItem,
  PurchaseRhythm,
} from "@/types/expense";
import { formatCurrency, formatQuantity } from "@/utils/currency";
import { formatFullDate } from "@/utils/date";
import {
  cycleLabel,
  dayLabel,
  lastBoughtLabel,
  recentRangeLabel,
  timingLabel,
} from "./rhythm-copy";

type Props = {
  item: PurchaseRhythm | PurchaseLearningItem | null;
  categories: ExpenseCategory[];
  onClose: () => void;
};

export default function RhythmDetailsDialog({ item, categories, onClose }: Props) {
  const rhythm = item && "typicalDays" in item ? item : null;
  const isPayment = rhythm?.kind === "payment";
  const noun = isPayment ? "payment" : "buy";

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={item?.name ?? "Purchase history"}
      description={
        item
          ? `${getCategoryIcon(categories, item.category)} ${item.category}`
          : undefined
      }
    >
      {item && (
        <div className="flex flex-col gap-7">
          {rhythm ? (
            <>
              <section className="rounded-xl border border-accent/30 bg-linear-to-br from-accent-soft to-surface p-5">
                <p className="text-lg font-semibold text-accent-strong">
                  {timingLabel(rhythm)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {lastBoughtLabel(rhythm)} on {formatFullDate(rhythm.lastBoughtOn)}.
                </p>
                <ProgressBar percent={rhythm.cycleProgressPct} className="mt-4" />
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {recentRangeLabel(rhythm)} The estimate uses the middle of the recent
                  gaps, so one unusually early or late {noun} does not take over.
                </p>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <StatTile
                  label={cycleLabel(rhythm)}
                  value={rhythm.monthly ? "Every month" : dayLabel(rhythm.typicalDays)}
                  helper={`${rhythm.purchaseCount} ${noun}s recorded`}
                />
                <StatTile
                  label="Last time"
                  value={dayLabel(rhythm.lastGapDays)}
                  helper={`between the last two ${noun}s`}
                />
                {!isPayment && (
                  <StatTile
                    label="Usually bought"
                    value={
                      rhythm.typicalQuantity !== null
                        ? formatQuantity(rhythm.typicalQuantity, rhythm.unit)
                        : "Not noted"
                    }
                    helper="at a time"
                  />
                )}
                <StatTile
                  label={isPayment ? "Usually paid" : "Usually costs"}
                  value={
                    rhythm.typicalAmount > 0
                      ? formatCurrency(rhythm.typicalAmount)
                      : "Not noted"
                  }
                  helper={isPayment ? "each time" : "per purchase"}
                  className={isPayment ? "col-span-2" : undefined}
                />
              </section>
            </>
          ) : (
            <section className="rounded-xl border border-accent/30 bg-linear-to-br from-accent-soft to-surface p-5">
              <p className="text-lg font-semibold text-accent-strong">
                One purchase recorded
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Bought {formatFullDate(item.lastBoughtOn)}. After the next purchase,
                this will show how many days it lasted and when it may be needed again.
              </p>
            </section>
          )}

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {isPayment ? "Payment log" : "Purchase log"}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Newest first · {item.history.length} shown
                </p>
              </div>
              <History className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            </div>

            <div className="mt-4">
              {item.history.map((event, index) => (
                <div
                  key={event.date}
                  className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-5 last:pb-0"
                >
                  <span className="relative flex justify-center" aria-hidden="true">
                    <span className="mt-1.5 h-3 w-3 rounded-full border-2 border-accent bg-surface" />
                    {index < item.history.length - 1 && (
                      <span className="absolute top-5 bottom-0 w-px bg-border" />
                    )}
                  </span>

                  <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-start gap-2">
                        <CalendarDays
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                          aria-hidden="true"
                        />
                        <span>
                          <span className="block text-[15px] font-semibold text-foreground">
                            {formatFullDate(event.date)}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-muted">
                            {event.daysSincePrevious === null
                              ? `First recorded ${noun}`
                              : `${dayLabel(event.daysSincePrevious)} after the previous ${noun}`}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground">
                        {formatCurrency(event.amount)}
                      </span>
                    </div>

                    {event.quantity !== null && (
                      <p className="mt-3 text-sm font-medium text-foreground">
                        {formatQuantity(event.quantity, event.unit)}
                      </p>
                    )}

                    {event.otherItems.length > 0 && (
                      <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                        <ShoppingBag
                          className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                        <span>Also logged that day: {event.otherItems.join(", ")}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {item.historyTruncated && (
              <p className="mt-4 text-center text-[13px] text-muted">
                Showing the latest {item.history.length} of {item.purchaseCount} recorded{" "}
                {noun}s.
              </p>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}
