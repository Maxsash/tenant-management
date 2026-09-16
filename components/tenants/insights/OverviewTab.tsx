"use client";

import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  TrendingUp,
} from "lucide-react";

import Card from "@/components/ui/Card";
import LockedCard from "@/components/ui/LockedCard";
import MonthColumns from "@/components/ui/MonthColumns";
import StatTile from "@/components/ui/StatTile";
import ProgressBar from "@/components/ui/ProgressBar";
import {
  formatCompactCurrency,
  formatCurrency,
  formatSignedCurrency,
} from "@/utils/currency";
import {
  formatMonthLabel,
  formatMonthShort,
  formatMonthCompact,
  formatOrdinal,
} from "@/utils/date";
import type { RentAlert, RentAnalytics } from "@/types/rent-analytics";

type Props = {
  data: RentAnalytics;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  unlocked: boolean;
  onRequestUnlock: () => void;
};

export default function OverviewTab({
  data,
  selectedMonth,
  onSelectMonth,
  unlocked,
  onRequestUnlock,
}: Props) {
  const { summary, months, fiscalYears, ahead, alerts } = data;
  if (!summary) return null;

  const windowLength = months.length;
  const lastProjected = ahead?.months.at(-1);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Monthly rent"
            value={formatCompactCurrency(summary.monthlyRent)}
            helper={`${formatCurrency(summary.monthlyRent)} from ${summary.currentTenants} tenant${summary.currentTenants === 1 ? "" : "s"}`}
          />
          <StatTile
            label="Collected"
            value={summary.windowCollectedPct === null ? "—" : `${summary.windowCollectedPct}%`}
            helper={`${formatCompactCurrency(summary.windowCollected)} of ${formatCompactCurrency(summary.windowExpected)} over ${windowLength} months`}
          />
          <StatTile
            label="On time"
            value={summary.windowOnTimePct === null ? "—" : `${summary.windowOnTimePct}%`}
            helper="of payments made by the 7th"
          />
          <StatTile
            label="Overdue"
            tone={summary.overdueAmount > 0 ? "danger" : "success"}
            value={summary.overdueAmount > 0 ? formatCompactCurrency(summary.overdueAmount) : "None"}
            helper={
              summary.overdueAmount > 0
                ? `from ${summary.overdueTenants} current tenant${summary.overdueTenants === 1 ? "" : "s"}`
                : "current tenants are paid up"
            }
          />
        </div>

        {summary.formerOwedAmount > 0 && (
          <p className="text-sm text-muted">
            Another {formatCurrency(summary.formerOwedAmount)} is not marked paid from{" "}
            {summary.formerOwedTenants} tenant{summary.formerOwedTenants === 1 ? "" : "s"} who
            moved out{unlocked ? " — see below" : ""}.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Needs a look</h2>
          <p className="text-sm text-muted">Money owed, changing habits and rent going up soon.</p>
        </div>

        {!unlocked ? (
          <LockedCard message="Enter the PIN to see which tenants need a look." onUnlock={onRequestUnlock} />
        ) : alerts.length === 0 ? (
          <Card className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <p className="text-sm text-muted">Nothing needs a look right now.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {alerts.map((alert) => (
              <AlertRow key={`${alert.kind}-${alert.id}`} alert={alert} />
            ))}
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Paid on time</h2>
          <p className="text-sm text-muted">
            Share of tenants who paid by the 7th, each month. A month still inside its
            first week has no bar yet.
          </p>
        </div>

        <Card className="p-5">
          <MonthColumns
            columns={months.map((m) => ({ month: m.month, value: m.onTimePct }))}
            selectedMonth={selectedMonth}
            onSelect={onSelectMonth}
            ariaLabel="Share paid on time each month"
            formatValue={(v) => `${v}%`}
            describe={(c) =>
              c.value === null
                ? `${formatMonthShort(c.month)}: not settled yet`
                : `${formatMonthShort(c.month)}: ${c.value}% paid on time`
            }
            max={100}
            height={112}
          />
        </Card>
      </section>

      {ahead && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Coming up</h2>
            <p className="text-sm text-muted">
              From the rent schedule, if nobody new moves in or out.
            </p>
          </div>

          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <p className="text-sm text-muted">Next 12 months</p>
                <p className="font-display text-[28px] leading-tight font-semibold text-foreground">
                  {formatCurrency(ahead.total)}
                </p>
              </div>
              {lastProjected && (
                <p className="text-sm text-muted">
                  {formatCurrency(summary.monthlyRent)} a month now,{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(lastProjected.expected)}
                  </span>{" "}
                  by {formatMonthLabel(lastProjected.month)}
                </p>
              )}
            </div>

            {unlocked && ahead.increases.length > 0 && (
              <div className="flex flex-col divide-y divide-border border-t border-border">
                {ahead.increases.map((c) => (
                  <div
                    key={`${c.id}-${c.month}`}
                    className="flex items-center justify-between gap-3 py-3 last:pb-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-foreground">
                        {c.name}
                      </span>
                      <span className="block text-xs text-muted">
                        from {formatMonthLabel(c.month)} rent
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(c.to)}
                      </span>
                      <span className="block text-xs tabular-nums text-muted">
                        {formatSignedCurrency(c.change)} a month
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {fiscalYears.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Financial years</h2>
            <p className="text-sm text-muted">April to March, by the month the rent is for.</p>
          </div>

          <Card className="flex flex-col gap-5 p-5">
            {fiscalYears.map((year) => (
              <div key={year.label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-foreground">FY {year.label}</span>{" "}
                    <span className="text-muted">
                      {formatMonthShort(year.from)}–{formatMonthShort(year.to)}
                      {year.isCurrent ? " so far" : year.startsLate ? " only" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">
                    {formatCurrency(year.collected)}
                  </span>
                </div>
                <ProgressBar percent={year.collectedPct ?? 0} />
                <p className="text-xs tabular-nums text-muted">
                  {year.collectedPct ?? 0}% of {formatCurrency(year.expected)} due
                </p>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: RentAlert }) {
  switch (alert.kind) {
    case "overdue": {
      const first = formatMonthCompact(alert.months[0]);
      const last = formatMonthCompact(alert.months.at(-1) as string);
      const when =
        alert.months.length === 1
          ? `${first} rent not marked paid`
          : `${alert.months.length} months not marked paid, between ${first} and ${last}`;

      return (
        <Row
          icon={<CircleAlert className="h-4 w-4 text-danger" aria-hidden="true" />}
          title={alert.name}
          tag={alert.isCurrent ? undefined : "moved out"}
          detail={when}
          value={formatCurrency(alert.amount)}
          warning={alert.exceedsDeposit ? "More than their deposit" : undefined}
        />
      );
    }
    case "late_streak":
      return (
        <Row
          icon={<Clock3 className="h-4 w-4 text-warning" aria-hidden="true" />}
          title={alert.name}
          detail={`Paid late the last ${alert.months} months, after usually paying on time`}
        />
      );
    case "paying_later":
      return (
        <Row
          icon={<TrendingUp className="h-4 w-4 text-warning" aria-hidden="true" />}
          title={alert.name}
          detail={`Paying later lately: used to pay by the ${formatOrdinal(alert.usualDay)}, now around the ${formatOrdinal(alert.recentDay)}`}
        />
      );
    case "increase_soon":
      return (
        <Row
          icon={<ArrowUpRight className="h-4 w-4 text-accent" aria-hidden="true" />}
          title={alert.name}
          detail={`Rent ${alert.change > 0 ? "goes up" : "changes"} from ${formatMonthLabel(alert.month)}: ${formatCurrency(alert.from)} → ${formatCurrency(alert.to)}`}
        />
      );
  }
}

function Row({
  icon,
  title,
  tag,
  detail,
  value,
  warning,
}: {
  icon: ReactNode;
  title: string;
  tag?: string;
  detail: string;
  value?: string;
  warning?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className="mt-1 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-[15px] font-medium text-foreground">
            {title}
            {tag && (
              <span className="ml-2 inline-block rounded-full bg-border/70 px-2 py-0.5 align-middle text-[11px] font-semibold text-muted">
                {tag}
              </span>
            )}
          </p>
          {value && (
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {value}
            </span>
          )}
        </div>
        <p className="text-sm text-muted">{detail}</p>
        {warning && <p className="text-xs font-semibold text-danger">{warning}</p>}
      </div>
    </div>
  );
}
