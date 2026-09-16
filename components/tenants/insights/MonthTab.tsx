"use client";

import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Hourglass, LogIn, LogOut } from "lucide-react";

import Card from "@/components/ui/Card";
import LockedCard from "@/components/ui/LockedCard";
import StatTile from "@/components/ui/StatTile";
import { formatCompactCurrency, formatCurrency, formatSignedCurrency } from "@/utils/currency";
import { formatMonthLabel, formatPayDayShort, formatShortDate } from "@/utils/date";
import { cn } from "@/utils/cn";
import type { RentMonthInsight, RentMonthTenant, RentState } from "@/types/rent-analytics";

type Props = {
  month: RentMonthInsight;
  unlocked: boolean;
  onRequestUnlock: () => void;
};

const STATE_ICON: Record<RentState, { icon: typeof CheckCircle2; className: string; label: string }> = {
  on_time: { icon: CheckCircle2, className: "text-success", label: "On time" },
  late: { icon: Clock3, className: "text-warning", label: "Late" },
  overdue: { icon: CircleAlert, className: "text-danger", label: "Unpaid" },
  due: { icon: Hourglass, className: "text-muted", label: "Not due yet" },
};

/** One rent month, tenant by tenant — the month picked on the chart above. */
export default function MonthTab({ month, unlocked, onRequestUnlock }: Props) {
  const label = formatMonthLabel(month.month);
  // A month is either still inside its first week, when nothing unpaid is
  // late yet, or past it, when everything unpaid is — never both at once.
  const unpaidCount = month.isOpen ? month.dueCount : month.overdueCount;
  const unpaidAmount = month.isOpen ? month.dueAmount : month.overdueAmount;
  const changes = month.changes;
  const hasChanges =
    changes !== null &&
    changes.movedIn.length + changes.movedOut.length + changes.rentChanges.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">{label}</h2>
          <p className="text-sm text-muted">
            Paid in the following month; on time means by {formatShortDate(month.dueBy)}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="On time"
            tone={month.onTimeCount > 0 ? "success" : "neutral"}
            value={`${month.onTimeCount} of ${month.tenantCount}`}
            helper={formatCompactCurrency(month.onTimeAmount)}
          />
          <StatTile
            label="Late"
            tone={month.lateCount > 0 ? "warning" : "neutral"}
            value={month.lateCount}
            helper={month.lateCount > 0 ? formatCompactCurrency(month.lateAmount) : "nobody"}
          />
          <StatTile
            label={month.isOpen ? "Not paid yet" : "Unpaid"}
            tone={month.overdueCount > 0 ? "danger" : "neutral"}
            value={unpaidCount}
            helper={
              unpaidCount === 0
                ? "nobody"
                : month.isOpen
                  ? `${formatCompactCurrency(unpaidAmount)} · due by ${formatShortDate(month.dueBy)}`
                  : formatCompactCurrency(unpaidAmount)
            }
          />
          <StatTile
            label="Usually paid by"
            value={month.medianPayDay === null ? "—" : formatPayDayShort(month.medianPayDay)}
            helper="half the payments came in by then"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Who paid when</h2>

        {!unlocked ? (
          <LockedCard message="Enter the PIN to see who paid when." onUnlock={onRequestUnlock} />
        ) : month.tenants.length === 0 ? (
          <Card className="p-5 text-sm text-muted">No rent was due this month.</Card>
        ) : (
          <Card className="divide-y divide-border">
            {month.tenants.map((tenant) => (
              <TenantRow key={tenant.id} tenant={tenant} dueBy={month.dueBy} />
            ))}
          </Card>
        )}
      </section>

      {unlocked && month.byBank.length > 1 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">By bank</h2>
            <p className="text-sm text-muted">What to expect on each bank statement.</p>
          </div>

          <Card className="flex flex-col gap-4 p-5">
            {month.byBank.map((bank) => (
              <div key={bank.bank ?? "none"} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{bank.bank ?? "Bank not recorded"}</span>
                  <span className="tabular-nums text-muted">
                    <span className="font-semibold text-foreground">{formatCurrency(bank.collected)}</span>{" "}
                    of {formatCurrency(bank.expected)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${bank.collectedPct ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {hasChanges && changes && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">What changed</h2>
            <p className="text-sm text-muted">Against the month before.</p>
          </div>

          <Card className="divide-y divide-border">
            {changes.movedIn.map((t) => (
              <ChangeRow
                key={`in-${t.id}`}
                icon={<LogIn className="h-4 w-4 text-success" aria-hidden="true" />}
                name={t.name}
                detail="Moved in"
                value={formatCurrency(t.amount)}
              />
            ))}
            {changes.movedOut.map((t) => (
              <ChangeRow
                key={`out-${t.id}`}
                icon={<LogOut className="h-4 w-4 text-muted" aria-hidden="true" />}
                name={t.name}
                detail="Last month of rent"
                value={formatCurrency(t.amount)}
              />
            ))}
            {changes.rentChanges.map((c) => (
              <ChangeRow
                key={`change-${c.id}`}
                icon={<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />}
                name={c.name}
                detail={`Rent ${formatCurrency(c.from)} → ${formatCurrency(c.to)}`}
                value={formatSignedCurrency(c.change)}
              />
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function TenantRow({ tenant, dueBy }: { tenant: RentMonthTenant; dueBy: string }) {
  const { icon: Icon, className, label } = STATE_ICON[tenant.state];

  const detail =
    tenant.state === "on_time" && tenant.paidOn
      ? `Paid ${formatShortDate(tenant.paidOn)}`
      : tenant.state === "late" && tenant.paidOn
        ? `Paid ${formatShortDate(tenant.paidOn)} · ${tenant.daysLate} day${tenant.daysLate === 1 ? "" : "s"} late`
        : tenant.state === "overdue"
          ? `Not marked paid · ${tenant.daysLate} day${tenant.daysLate === 1 ? "" : "s"} past ${formatShortDate(dueBy)}`
          : `Due by ${formatShortDate(dueBy)}`;

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="flex min-w-0 items-center gap-3">
        <Icon className={cn("h-5 w-5 shrink-0", className)} aria-label={label} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-foreground">{tenant.name}</span>
          <span
            className={cn(
              "block text-xs",
              tenant.state === "overdue" ? "text-danger" : "text-muted"
            )}
          >
            {detail}
          </span>
        </span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums text-foreground">
        {formatCurrency(tenant.amount)}
      </span>
    </div>
  );
}

function ChangeRow({
  icon,
  name,
  detail,
  value,
}: {
  icon: ReactNode;
  name: string;
  detail: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-foreground">{name}</span>
          <span className="block text-xs text-muted">{detail}</span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
