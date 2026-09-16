"use client";

import { useState } from "react";

import Card from "@/components/ui/Card";
import DeltaChip from "@/components/ui/DeltaChip";
import EmptyState from "@/components/ui/EmptyState";
import MonthColumns from "@/components/ui/MonthColumns";
import PageContainer from "@/components/ui/PageContainer";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Tabs, { TabsContent } from "@/components/ui/Tabs";
import ExpenseSectionNav from "../ExpenseSectionNav";
import ChecksTab from "./ChecksTab";
import ConsumptionTab from "./ConsumptionTab";
import SpendingTab from "./SpendingTab";
import { formatCurrency } from "@/utils/currency";
import { formatMonthLabel } from "@/utils/date";
import type { ExpenseAnalytics, ExpenseCategory } from "@/types/expense";

const WINDOWS = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
];

const TABS = [
  { value: "spending", label: "Spending" },
  { value: "consumption", label: "Consumption" },
  { value: "checks", label: "Checks" },
];

type Props = {
  data: ExpenseAnalytics | null;
  categories: ExpenseCategory[];
  loading: boolean;
  windowMonths: string;
  onWindowChange: (months: string) => void;
  onRequestUnlock: () => void;
};

export default function InsightsView({
  data,
  categories,
  loading,
  windowMonths,
  onWindowChange,
  onRequestUnlock,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [tab, setTab] = useState("spending");

  const months = data?.months ?? [];
  // A month picked under a wider window can fall outside a narrower one, so
  // the latest month is always the fallback.
  const active =
    months.find((m) => m.month === selectedMonth) ?? months.at(-1) ?? null;
  const monthIndex = active
    ? months.findIndex((m) => m.month === active.month)
    : -1;
  const unlocked = data?.unlocked ?? false;

  return (
    <PageContainer size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Insights
          </h1>
          <ExpenseSectionNav className="md:w-64" />
        </div>

        {/* One filter row, scoping everything below it. */}
        <SegmentedControl
          options={WINDOWS}
          value={windowMonths}
          onChange={onWindowChange}
          ariaLabel="How far back to look"
        />
      </div>

      {!active ? (
        <EmptyState
          title="Nothing to chart yet"
          description="Log a few expenses and the trends will show up here."
        />
      ) : (
        <div
          // Hold the previous render while a wider window loads rather than
          // flashing a skeleton and jumping the layout.
          className={`flex flex-col gap-8 ${loading ? "opacity-60" : ""}`}
        >
          <Card className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div>
                <p className="text-sm font-medium text-muted">
                  {formatMonthLabel(active.month)}
                  {active.isCurrentMonth && " so far"}
                </p>
                <p className="font-display text-[40px] leading-tight font-semibold text-foreground">
                  {formatCurrency(active.total)}
                </p>
              </div>
              <DeltaChip deltaPct={active.deltaPct} />
            </div>

            <MonthColumns
              columns={months.map((m) => ({ month: m.month, value: m.total }))}
              selectedMonth={active.month}
              onSelect={setSelectedMonth}
              ariaLabel="Monthly spend"
            />

            <p className="text-xs text-muted">Tap a month to look at it.</p>
          </Card>

          <Tabs items={TABS} value={tab} onValueChange={setTab}>
            <TabsContent value="spending" className="pt-6 outline-none">
              <SpendingTab
                month={active}
                monthIndex={monthIndex}
                categories={data?.categories ?? []}
                categoryIcons={categories}
                unlocked={unlocked}
                onRequestUnlock={onRequestUnlock}
              />
            </TabsContent>

            <TabsContent value="consumption" className="pt-6 outline-none">
              <ConsumptionTab
                month={active}
                monthIndex={monthIndex}
                months={months}
                consumption={data?.consumption ?? []}
                items={data?.items ?? []}
                unlocked={unlocked}
                onRequestUnlock={onRequestUnlock}
              />
            </TabsContent>

            <TabsContent value="checks" className="pt-6 outline-none">
              <ChecksTab
                month={active}
                unlocked={unlocked}
                onRequestUnlock={onRequestUnlock}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </PageContainer>
  );
}
