"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Hourglass } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DeltaChip from "@/components/ui/DeltaChip";
import EmptyState from "@/components/ui/EmptyState";
import MonthColumns from "@/components/ui/MonthColumns";
import PageContainer from "@/components/ui/PageContainer";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Tabs, { TabsContent } from "@/components/ui/Tabs";
import TenantSectionNav from "../TenantSectionNav";
import DepositsTab from "./DepositsTab";
import MonthTab from "./MonthTab";
import OverviewTab from "./OverviewTab";
import TenantsTab from "./TenantsTab";
import { formatCurrency } from "@/utils/currency";
import { formatMonthLabel, formatMonthShort, formatShortDate } from "@/utils/date";
import type { RentAnalytics, RentMonthInsight } from "@/types/rent-analytics";

const WINDOWS = [
  { value: "6", label: "6 months" },
  { value: "12", label: "1 year" },
  { value: "24", label: "2 years" },
];

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "month", label: "Month" },
  { value: "tenants", label: "Tenants" },
  { value: "deposits", label: "Deposits" },
];

type Props = {
  data: RentAnalytics | null;
  failed: boolean;
  loading: boolean;
  windowMonths: string;
  onWindowChange: (months: string) => void;
  onRetry: () => void;
  onRequestUnlock: () => void;
};

export default function RentInsightsView({
  data,
  failed,
  loading,
  windowMonths,
  onWindowChange,
  onRetry,
  onRequestUnlock,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");

  const months = data?.months ?? [];
  // A month picked under a wider window can fall outside a narrower one, so
  // the latest month is always the fallback.
  const active =
    months.find((m) => m.month === selectedMonth) ?? months.at(-1) ?? null;
  const unlocked = data?.unlocked ?? false;

  // Tapping a column is asking about that month, so the answer comes up
  // directly underneath rather than on a tab the reader has to find.
  function selectMonth(month: string) {
    setSelectedMonth(month);
    setTab("month");
  }

  return (
    <PageContainer size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Insights
          </h1>
          <TenantSectionNav className="md:w-64" />
        </div>

        {/* One filter row, scoping everything below it. */}
        <SegmentedControl
          options={WINDOWS}
          value={windowMonths}
          onChange={onWindowChange}
          ariaLabel="How far back to look"
        />
      </div>

      {!data && failed ? (
        <EmptyState
          title="Couldn't load rent insights"
          description="Check the connection and try again."
          action={
            <Button variant="outline" onClick={onRetry} className="mt-2">
              Retry
            </Button>
          }
        />
      ) : !active || !data ? (
        <EmptyState
          title="Nothing to show yet"
          description="Once rent has come due, how it was paid will show up here."
        />
      ) : (
        <div
          // Hold the previous render while a wider window loads rather than
          // flashing a skeleton and jumping the layout.
          className={`flex flex-col gap-8 transition-opacity ${loading ? "opacity-60" : ""}`}
        >
          <Card className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div>
                <p className="text-sm font-medium text-muted">
                  Rent for {formatMonthLabel(active.month)}
                </p>
                <p className="font-display text-[40px] leading-tight font-semibold text-foreground">
                  {formatCurrency(active.collected)}
                </p>
                <p className="text-sm text-muted">
                  collected of {formatCurrency(active.expected)}
                  {active.collectedPct !== null && ` · ${active.collectedPct}%`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <MonthStatus month={active} />
                <DeltaChip
                  deltaPct={active.expectedDeltaPct}
                  tone="income"
                  label="total rent vs the month before"
                />
              </div>
            </div>

            <MonthColumns
              columns={months.map((m) => ({
                month: m.month,
                value: m.collected,
                total: m.expected,
              }))}
              selectedMonth={active.month}
              onSelect={selectMonth}
              ariaLabel="Rent collected each month"
              describe={(c) =>
                `${formatMonthShort(c.month)}: ${formatCurrency(c.value ?? 0)} collected of ${formatCurrency(c.total ?? 0)}`
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" />
                  Collected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-accent/15" aria-hidden="true" />
                  Not collected
                </span>
              </span>
              <span>Tap a month to see who paid.</span>
            </div>
          </Card>

          <Tabs items={TABS} value={tab} onValueChange={setTab}>
            <TabsContent value="overview" className="pt-6 outline-none">
              <OverviewTab
                data={data}
                selectedMonth={active.month}
                onSelectMonth={selectMonth}
                unlocked={unlocked}
                onRequestUnlock={onRequestUnlock}
              />
            </TabsContent>

            <TabsContent value="month" className="pt-6 outline-none">
              <MonthTab
                month={active}
                unlocked={unlocked}
                onRequestUnlock={onRequestUnlock}
              />
            </TabsContent>

            <TabsContent value="tenants" className="pt-6 outline-none">
              <TenantsTab
                months={months}
                current={data.currentTenants}
                former={data.formerTenants}
                unlocked={unlocked}
                onRequestUnlock={onRequestUnlock}
              />
            </TabsContent>

            <TabsContent value="deposits" className="pt-6 outline-none">
              <DepositsTab
                deposits={data.deposits}
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

/** Where the focused month stands, in words and an icon, never colour alone. */
function MonthStatus({ month }: { month: RentMonthInsight }) {
  if (month.overdueCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
        <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
        {month.overdueCount} unpaid
      </span>
    );
  }

  if (month.dueCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
        <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
        {month.dueCount} due by {formatShortDate(month.dueBy)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      All paid
    </span>
  );
}
