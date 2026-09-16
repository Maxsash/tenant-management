"use client";

import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import Card from "@/components/ui/Card";
import LockedCard from "@/components/ui/LockedCard";
import DeltaChip from "@/components/ui/DeltaChip";
import MiniBars from "./MiniBars";
import ConsumptionTable from "./ConsumptionTable";
import {
  buildConsumptionTable,
  listMeasurableCategories,
} from "@/lib/consumption-table";
import {
  formatCurrency,
  formatDeltaPct,
  formatQuantity,
} from "@/utils/currency";
import { formatMonthShort } from "@/utils/date";
import type {
  ConsumptionMeasure,
  ConsumptionSeries,
  ItemSeries,
  MonthInsight,
} from "@/types/expense";

type Props = {
  month: MonthInsight;
  monthIndex: number;
  months: MonthInsight[];
  consumption: ConsumptionSeries[];
  items: ItemSeries[];
  unlocked: boolean;
  onRequestUnlock: () => void;
};

const VISIBLE_GROUPS = 4;

export default function ConsumptionTab({
  month,
  monthIndex,
  months,
  consumption,
  items,
  unlocked,
  onRequestUnlock,
}: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [measure, setMeasure] = useState<ConsumptionMeasure>("quantity");

  const measurable = useMemo(() => listMeasurableCategories(items), [items]);
  // Defaults to the category with the most money in it, which is the produce
  // basket for this household, but stays on whatever has been picked.
  const activeCategory =
    measurable.find((c) => c.category === category)?.category ??
    measurable[0]?.category ??
    null;
  const table = useMemo(
    () =>
      activeCategory
        ? buildConsumptionTable(items, activeCategory, measure)
        : null,
    [items, activeCategory, measure]
  );

  // Every hook has to run before this, so the locked branch comes after them.
  if (!unlocked) {
    return (
      <LockedCard message="Enter the PIN to see what was consumed." onUnlock={onRequestUnlock} />
    );
  }

  // The headline cards answer "what came in this month"; a staple that is
  // missing is a data question and belongs on the Checks tab.
  const groups = consumption
    .filter((c) => (c.quantities[monthIndex] ?? 0) > 0)
    .slice(0, VISIBLE_GROUPS);
  const needsUnitFix = items.filter((i) => i.mixedUnits);
  const window = months.map((m) => formatMonthShort(m.month)).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            How much came in
          </h2>
          <p className="text-sm text-muted">
            Totals for the month you picked. Bars run {window}.
          </p>
        </div>

        {groups.length === 0 ? (
          <Card className="p-5 text-sm text-muted">
            Nothing with a recorded quantity this month.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.map((c) => (
              <Card
                key={`${c.category}-${c.unit}`}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold uppercase tracking-wide text-muted">
                    {c.category}
                  </p>
                  <p className="font-display text-[26px] font-semibold leading-tight text-foreground">
                    {formatQuantity(c.quantities[monthIndex] ?? 0, c.unit)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs tabular-nums text-muted">
                    {formatCurrency(c.amounts[monthIndex] ?? 0)}
                    <DeltaChip
                      deltaPct={c.deltaPcts[monthIndex] ?? null}
                      tone="neutral"
                    />
                  </p>
                </div>
                <MiniBars
                  values={c.quantities}
                  highlightIndex={monthIndex}
                  className="h-10 shrink-0"
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      {month.priceMoves.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              What changed price
            </h2>
            <p className="text-sm text-muted">
              Per-unit rate against the previous month.
            </p>
          </div>

          <Card className="divide-y divide-border">
            {month.priceMoves.map((move) => {
              const up = move.deltaPct > 0;
              const Icon = up ? TrendingUp : TrendingDown;

              return (
                <div
                  key={move.name}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-foreground">
                      {move.name}
                    </span>
                    <span className="block text-xs tabular-nums text-muted">
                      {formatCurrency(move.prevRate)} to{" "}
                      {formatCurrency(move.rate)} per {move.unit}
                    </span>
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums ${
                      up ? "text-danger" : "text-success"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {formatDeltaPct(move.deltaPct)}
                  </span>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      <ConsumptionTable
        table={table}
        categories={measurable}
        category={activeCategory ?? ""}
        onCategoryChange={setCategory}
        measure={measure}
        onMeasureChange={setMeasure}
        months={months}
        monthIndex={monthIndex}
      />

      {needsUnitFix.length > 0 && (
        <Card className="border-warning-border bg-warning-soft p-5">
          <p className="text-sm font-semibold text-warning">
            {needsUnitFix.length} item
            {needsUnitFix.length === 1 ? " has" : "s have"} been logged in more
            than one unit
          </p>
          <p className="mt-1 text-sm text-warning">
            Quantities cannot be added up for{" "}
            {needsUnitFix.map((i) => i.name).join(", ")}, so no total is shown.
            Settle on one unit per item to track it here.
          </p>
        </Card>
      )}
    </div>
  );
}
