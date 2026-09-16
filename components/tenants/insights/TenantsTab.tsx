"use client";

import { useState } from "react";
import { ArrowUpRight, CircleAlert, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import Card from "@/components/ui/Card";
import LockedCard from "@/components/ui/LockedCard";
import StatusStrip, { StatusLegend } from "./StatusStrip";
import { formatCompactCurrency, formatCurrency } from "@/utils/currency";
import {
  formatFullDate,
  formatMonthLabel,
  formatMonthCompact,
  formatPayDay,
} from "@/utils/date";
import { cn } from "@/utils/cn";
import type { RentMonthInsight, TenantInsight } from "@/types/rent-analytics";

type Props = {
  months: RentMonthInsight[];
  current: TenantInsight[];
  former: TenantInsight[];
  unlocked: boolean;
  onRequestUnlock: () => void;
};

/** An on-time run this long is worth a word of credit on the card. */
const STREAK_WORTH_MENTIONING = 6;

export default function TenantsTab({ months, current, former, unlocked, onRequestUnlock }: Props) {
  const [showFormer, setShowFormer] = useState(false);

  if (!unlocked) {
    return (
      <LockedCard
        message="Enter the PIN to see each tenant's payment history."
        onUnlock={onRequestUnlock}
      />
    );
  }

  const firstMonth = months[0]?.month;
  const lastMonth = months.at(-1)?.month;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          One mark per month,{" "}
          {firstMonth && lastMonth
            ? `${formatMonthCompact(firstMonth)} to ${formatMonthCompact(lastMonth)}`
            : "oldest first"}
          . Anyone owing rent comes first.
        </p>
        <StatusLegend />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Current tenants <span className="text-muted">({current.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {current.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} windowLength={months.length} />
          ))}
        </div>
      </section>

      {former.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowFormer((v) => !v)}
            aria-expanded={showFormer}
            className="flex min-h-11 items-center justify-between gap-3 text-left"
          >
            <h2 className="font-display text-xl font-semibold text-foreground">
              Moved out <span className="text-muted">({former.length})</span>
            </h2>
            <span className="text-sm font-semibold text-accent">
              {showFormer ? "Hide" : "Show"}
            </span>
          </button>

          {showFormer && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {former.map((tenant) => (
                <TenantCard key={tenant.id} tenant={tenant} windowLength={months.length} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TenantCard({ tenant, windowLength }: { tenant: TenantInsight; windowLength: number }) {
  const isFormer = tenant.movedOutOn !== null;
  const settled = tenant.settledCount;

  const meta = [
    tenant.propertyType,
    isFormer
      ? tenant.movedOutOn && `moved out ${formatFullDate(tenant.movedOutOn)}`
      : tenant.yearsWithUs !== null
        ? tenant.yearsWithUs === 0
          ? "under a year"
          : `${tenant.yearsWithUs} yr${tenant.yearsWithUs === 1 ? "" : "s"}`
        : null,
    tenant.sharePct !== null && `${tenant.sharePct}% of rent`,
  ].filter(Boolean);

  const summary =
    settled === 0
      ? "No rent due yet in this window"
      : `${tenant.onTimeCount} on time, ${tenant.lateCount} late, ${tenant.overdueCount} unpaid, over ${windowLength} months`;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-foreground">{tenant.name}</p>
          <p className="text-xs text-muted">{meta.join(" · ")}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums text-foreground">{formatCurrency(tenant.rent)}</p>
          <p className="text-xs text-muted">{isFormer ? "last rent" : "a month"}</p>
        </div>
      </div>

      <StatusStrip history={tenant.history} summary={summary} />

      <p className="text-sm text-muted">
        {tenant.firstRentMonth ? (
          <>First rent is for {formatMonthLabel(tenant.firstRentMonth)}.</>
        ) : settled === 0 ? (
          <>{formatCompactCurrency(tenant.collected)} collected since records began.</>
        ) : (
          <>
            On time{" "}
            <span className="font-semibold text-foreground">
              {tenant.onTimeCount} of {settled}
            </span>
            {tenant.medianPayDay !== null && <> · usually {formatPayDay(tenant.medianPayDay)}</>}
          </>
        )}
      </p>

      <Chips tenant={tenant} isFormer={isFormer} />
    </Card>
  );
}

function Chips({ tenant, isFormer }: { tenant: TenantInsight; isFormer: boolean }) {
  const chips: { key: string; icon: typeof CircleAlert; text: string; tone: string }[] = [];

  if (tenant.owed > 0) {
    chips.push({
      key: "owed",
      icon: CircleAlert,
      text: `${formatCurrency(tenant.owed)} not marked paid (${tenant.owedMonths.length} mo)`,
      tone: "bg-danger-soft text-danger",
    });
  }
  if (!isFormer && tenant.onTimeStreak >= STREAK_WORTH_MENTIONING) {
    chips.push({
      key: "streak",
      icon: Sparkles,
      text: `On time ${tenant.onTimeStreak} months running`,
      tone: "bg-success-soft text-success",
    });
  }
  if (!isFormer && tenant.trend === "later" && tenant.recentPayDay !== null) {
    chips.push({
      key: "later",
      icon: TrendingUp,
      text: `Paying later lately, ${formatPayDay(tenant.recentPayDay)}`,
      tone: "bg-warning-soft text-warning",
    });
  }
  if (!isFormer && tenant.trend === "earlier" && tenant.recentPayDay !== null) {
    chips.push({
      key: "earlier",
      icon: TrendingDown,
      text: `Paying earlier lately, ${formatPayDay(tenant.recentPayDay)}`,
      tone: "bg-success-soft text-success",
    });
  }
  if (tenant.nextIncrease) {
    chips.push({
      key: "increase",
      icon: ArrowUpRight,
      text: `Rent ${formatCurrency(tenant.nextIncrease.to)} from ${formatMonthCompact(tenant.nextIncrease.month)}`,
      tone: "bg-accent-soft text-accent",
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ key, icon: Icon, text, tone }) => (
        <span
          key={key}
          className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tone)}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {text}
        </span>
      ))}
    </div>
  );
}
