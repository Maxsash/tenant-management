"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, ChevronRight } from "lucide-react";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import LockedCard from "@/components/ui/LockedCard";
import { getCategoryIcon } from "@/lib/expense-categories";
import type {
  ExpenseCategory,
  HouseholdNeeds,
  PurchaseLearningItem,
  PurchaseRhythm,
  ShoppingGroup,
} from "@/types/expense";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/currency";
import { formatShortDate } from "@/utils/date";
import LastingGroups from "./LastingGroups";
import RhythmDetailsDialog from "./RhythmDetailsDialog";
import { dueLabel, roundDetail, roundTitle, usualQuantityLabel } from "./rhythm-copy";

type Props = {
  needs: HouseholdNeeds | null;
  categories: ExpenseCategory[];
  unlocked: boolean;
  onRequestUnlock: () => void;
};

/** Every item the tab can open, so the detail sheet finds it by key. */
function findItem(
  needs: HouseholdNeeds,
  key: string | null
): PurchaseRhythm | PurchaseLearningItem | null {
  if (key === null) return null;

  const all: (PurchaseRhythm | PurchaseLearningItem)[] = [
    ...needs.paymentRounds.flatMap((round) => round.payments),
    ...needs.lasting.flatMap((group) => [...group.rhythms, ...group.learningItems]),
  ];
  return all.find((item) => item.key === key) ?? null;
}

export default function NeedsTab({
  needs,
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

  if (!needs || (needs.lasting.length === 0 && needs.paymentRounds.length === 0)) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="A little more history is needed"
        description="Once the same item has been logged on two different days, its usual gap will appear here."
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground">
              What may be needed next
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              A gentle estimate from the gaps between earlier purchases, one list
              per category.
            </p>
          </div>

          {needs.shopping.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {needs.shopping.map((group, index) => (
                <ShoppingCard
                  key={group.category}
                  group={group}
                  icon={getCategoryIcon(categories, group.category)}
                  featured={index === 0}
                  onSelect={setSelectedKey}
                />
              ))}
            </div>
          ) : (
            <Card className="flex items-start gap-3 border-success-border bg-success-soft p-4">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-success"
                aria-hidden="true"
              />
              <p className="text-sm leading-relaxed text-success">
                Nothing looks due in the next few days.
                {needs.nextUp &&
                  ` Next up: ${needs.nextUp.name}, around ${formatShortDate(needs.nextUp.nextDueOn)}.`}
              </p>
            </Card>
          )}
        </section>

        {needs.paymentRounds.length > 0 && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Regular payments
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">
                Staff, bills and anything else paid on a steady cycle.
                {needs.paymentsTotal > 0 &&
                  ` A full round of them comes to about ${formatCurrency(needs.paymentsTotal)}.`}
              </p>
            </div>

            {needs.paymentRounds.map((round) => (
              <Card key={round.dueOn ?? "lapsed"} className="overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {roundTitle(round)}
                  </h3>
                  {round.dueOn && (
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {formatCurrency(round.total)}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "px-5 text-[13px]",
                    round.timing === "now" || round.timing === "soon"
                      ? "font-semibold text-accent-strong"
                      : "text-muted"
                  )}
                >
                  {roundDetail(round)}
                </p>

                <ul className="mt-2 divide-y divide-border border-t border-border">
                  {round.payments.map((payment) => (
                    <li key={payment.key}>
                      <button
                        type="button"
                        aria-label={`View payment history for ${payment.name}`}
                        onClick={() => setSelectedKey(payment.key)}
                        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-accent-soft/45 focus-visible:bg-accent-soft/45 focus-visible:outline-none"
                      >
                        <span
                          className={cn(
                            "min-w-0 truncate text-base font-semibold",
                            round.dueOn ? "text-foreground" : "text-muted"
                          )}
                        >
                          <span aria-hidden="true">
                            {getCategoryIcon(categories, payment.category)}
                          </span>{" "}
                          {payment.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="tabular-nums text-foreground">
                            {formatCurrency(payment.typicalAmount)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-accent" aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </section>
        )}

        {needs.lasting.length > 0 && (
          <LastingGroups
            groups={needs.lasting}
            categories={categories}
            onSelect={setSelectedKey}
          />
        )}
      </div>

      <RhythmDetailsDialog
        item={findItem(needs, selectedKey)}
        categories={categories}
        onClose={() => setSelectedKey(null)}
      />
    </>
  );
}

function ShoppingCard({
  group,
  icon,
  featured,
  onSelect,
}: {
  group: ShoppingGroup;
  icon: string;
  featured: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden",
        featured &&
          "border-accent/35 bg-linear-to-br from-accent-soft via-surface to-surface sm:col-span-2"
      )}
    >
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <h3
          className={cn(
            "font-display font-semibold text-foreground",
            featured ? "text-xl" : "text-lg"
          )}
        >
          {icon} {group.category}
        </h3>
        {group.estimatedAmount > 0 && (
          <span className="shrink-0 text-sm text-muted">
            about{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(group.estimatedAmount)}
            </span>
          </span>
        )}
      </div>

      <ul className="pb-2">
        {group.items.map((rhythm) => (
          <li key={rhythm.key}>
            <button
              type="button"
              aria-label={`View purchase history for ${rhythm.name}`}
              onClick={() => onSelect(rhythm.key)}
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-2.5 text-left transition-colors hover:bg-accent-soft/45 focus-visible:bg-accent-soft/45 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-foreground">
                  {rhythm.name}
                </span>
                {rhythm.typicalQuantity !== null && (
                  <span className="block text-[13px] text-muted">
                    {usualQuantityLabel(rhythm)}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm",
                  rhythm.timing === "now"
                    ? "font-semibold text-accent-strong"
                    : "text-muted"
                )}
              >
                {dueLabel(rhythm)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
