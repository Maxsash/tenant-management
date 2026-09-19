"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ShoppingBasket,
  TimerReset,
} from "lucide-react";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import LockedCard from "@/components/ui/LockedCard";
import ProgressBar from "@/components/ui/ProgressBar";
import { getCategoryIcon } from "@/lib/expense-categories";
import type {
  ExpenseCategory,
  PurchaseLearningItem,
  PurchaseRhythm,
} from "@/types/expense";
import { formatCurrency, formatQuantity } from "@/utils/currency";
import { formatShortDate } from "@/utils/date";
import RhythmDetailsDialog from "./RhythmDetailsDialog";
import {
  dayLabel,
  evidenceLabel,
  lastBoughtLabel,
  timingLabel,
} from "./rhythm-copy";

type Props = {
  rhythms: PurchaseRhythm[];
  learningItems: PurchaseLearningItem[];
  categories: ExpenseCategory[];
  unlocked: boolean;
  onRequestUnlock: () => void;
};

export default function NeedsTab({
  rhythms,
  learningItems,
  categories,
  unlocked,
  onRequestUnlock,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (!unlocked) {
    return (
      <LockedCard
        message="Enter the family PIN to see when household items may be needed again."
        onUnlock={onRequestUnlock}
      />
    );
  }

  if (rhythms.length === 0 && learningItems.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="A little more history is needed"
        description="Once the same item has been logged on two different days, its usual gap will appear here."
      />
    );
  }

  const next = rhythms.slice(0, 3);
  const selectedItem =
    rhythms.find((rhythm) => rhythm.key === selectedKey) ??
    learningItems.find((item) => item.key === selectedKey) ??
    null;

  return (
    <>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground">
              What may be needed next
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              A gentle estimate from the gaps between earlier purchases.
            </p>
          </div>

          {next.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {next.map((rhythm, index) => (
                <Card
                  key={rhythm.key}
                  onClick={() => setSelectedKey(rhythm.key)}
                  aria-label={`View purchase history for ${rhythm.name}`}
                  className={
                    index === 0
                      ? "relative cursor-pointer overflow-hidden border-accent/35 bg-linear-to-br from-accent-soft via-surface to-surface p-5 transition-colors hover:border-accent/60 sm:col-span-2"
                      : "cursor-pointer p-5 transition-colors hover:border-accent/60"
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted">
                        {getCategoryIcon(categories, rhythm.category)}{" "}
                        {rhythm.category}
                      </p>
                      <h3
                        className={
                          index === 0
                            ? "mt-1 font-display text-[30px] leading-tight font-semibold text-foreground"
                            : "mt-1 font-display text-xl font-semibold text-foreground"
                        }
                      >
                        {rhythm.name}
                      </h3>
                    </div>
                    <span className="porthole flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-card">
                      <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>

                  <p className="mt-5 text-lg font-semibold leading-snug text-accent-strong">
                    {timingLabel(rhythm)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Usually about {dayLabel(rhythm.typicalDays)} between buys
                  </p>
                  <ProgressBar percent={rhythm.cycleProgressPct} className="mt-4" />
                  <div className="mt-3 flex items-center justify-between gap-3 text-[13px] text-muted">
                    <span>
                      {lastBoughtLabel(rhythm)} ·{" "}
                      {formatShortDate(rhythm.lastBoughtOn)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-semibold text-accent">
                      View history
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No repeat interval yet"
              description="The first purchases are below. One more logged buy will show how long each item lasted."
              className="py-7"
            />
          )}

          {next.length > 0 && next.every((rhythm) => rhythm.timing === "later") && (
            <Card className="flex items-center gap-3 border-success-border bg-success-soft p-4">
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-success"
                aria-hidden="true"
              />
              <p className="text-sm text-success">
                Nothing in the usual household rhythm looks due just yet.
              </p>
            </Card>
          )}
        </section>

        {rhythms.length > 0 && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                How long things last
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">
                For a cylinder this is time between refills; for groceries, time
                between buys.
              </p>
            </div>

            <Card className="divide-y divide-border overflow-hidden">
              {rhythms.map((rhythm) => (
                <button
                  key={rhythm.key}
                  type="button"
                  aria-label={`View purchase history for ${rhythm.name}`}
                  onClick={() => setSelectedKey(rhythm.key)}
                  className="block w-full cursor-pointer px-5 py-4 text-left transition-colors hover:bg-accent-soft/45 focus-visible:bg-accent-soft/45 focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-4">
                    <span className="flex min-w-0 items-start gap-3">
                      <TimerReset
                        className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold text-foreground">
                          {rhythm.name}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-muted">
                          {evidenceLabel(rhythm)}
                        </span>
                        {rhythm.typicalQuantity !== null && (
                          <span className="mt-0.5 block text-[13px] text-muted">
                            Usually{" "}
                            {formatQuantity(rhythm.typicalQuantity, rhythm.unit)} at a
                            time
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-right">
                      <span>
                        <span className="block font-display text-2xl font-semibold tabular-nums text-foreground">
                          {rhythm.typicalDays}
                        </span>
                        <span className="block text-xs text-muted">
                          {rhythm.typicalDays === 1 ? "day" : "days"}
                        </span>
                      </span>
                      <ChevronRight
                        className="h-4 w-4 text-accent"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </button>
              ))}
            </Card>
          </section>
        )}

        {learningItems.length > 0 && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Still learning
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">
                Bought once so far. The next buy will reveal how long it lasted.
              </p>
            </div>

            <Card className="divide-y divide-border overflow-hidden">
              {learningItems.map((item) => {
                const event = item.history[0];

                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-label={`View purchase details for ${item.name}`}
                    onClick={() => setSelectedKey(item.key)}
                    className="block w-full cursor-pointer px-5 py-4 text-left transition-colors hover:bg-accent-soft/45 focus-visible:bg-accent-soft/45 focus-visible:outline-none"
                  >
                    <span className="flex items-start justify-between gap-4">
                      <span className="flex min-w-0 items-start gap-3">
                        <CalendarClock
                          className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold text-foreground">
                            {item.name}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-muted">
                            Bought {formatShortDate(item.lastBoughtOn)}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-muted">
                            One more buy will show its rhythm
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-right">
                        <span>
                          <span className="block font-semibold tabular-nums text-foreground">
                            {event ? formatCurrency(event.amount) : ""}
                          </span>
                          {event?.quantity !== null && event?.quantity !== undefined && (
                            <span className="block text-xs text-muted">
                              {formatQuantity(event.quantity, event.unit)}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-accent" aria-hidden="true" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </Card>
          </section>
        )}
      </div>

      <RhythmDetailsDialog
        item={selectedItem}
        categories={categories}
        onClose={() => setSelectedKey(null)}
      />
    </>
  );
}
