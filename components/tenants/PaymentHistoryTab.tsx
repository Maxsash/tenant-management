"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

import Button from "@/components/ui/Button";
import StatTile from "@/components/ui/StatTile";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { formatFullDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { paymentHistory, type PaymentHistoryData } from "@/services/paymentHistory";
import { cn } from "@/utils/cn";

type Props = {
  tenantId: string;
};

const statusLabel: Record<string, string> = {
  paid: "Paid",
  late: "Late",
  pending: "Pending",
};

const statusClasses: Record<string, string> = {
  paid: "bg-success-soft text-success",
  late: "bg-warning-soft text-warning",
  pending: "bg-danger-soft text-danger",
};

export default function PaymentHistoryTab({ tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<PaymentHistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllMonths, setShowAllMonths] = useState(false);

  useEffect(() => {
    if (tenantId) loadPaymentHistory();
  }, [tenantId]);

  async function loadPaymentHistory() {
    try {
      setLoading(true);
      setError(null);

      const data = await paymentHistory.getTenantPaymentHistory(tenantId);
      setPaymentData(data);
    } catch (err) {
      console.error("Error loading payment history:", err);
      setError("Unable to load payment history. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-4">
        <EmptyState
          title="Couldn't load payment history"
          description={error}
          action={
            <Button variant="outline" onClick={loadPaymentHistory} className="mt-2">
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!paymentData || paymentData.monthlyBreakdown.length === 0) {
    return (
      <div className="px-5 py-4">
        <EmptyState title="No payment history available" />
      </div>
    );
  }

  const { summary, monthlyBreakdown } = paymentData;
  const visibleMonths = showAllMonths ? monthlyBreakdown : monthlyBreakdown.slice(0, 6);

  return (
    <div className="flex flex-col gap-5 px-5 py-4">
      <div className="flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-sm text-accent">
        <Info className="h-4 w-4 shrink-0 translate-y-0.5" />
        <span>Showing payment records from December 2023 onwards</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Total Paid"
          value={formatCurrency(summary.totalPaid)}
          tone="success"
        />
        <StatTile
          label="Pending"
          value={formatCurrency(summary.totalPending)}
          tone="danger"
        />
        <StatTile
          label="On-Time"
          value={`${summary.onTimePercentage}%`}
          helper={`${summary.onTimeCount} on-time · ${summary.latePaymentCount} late`}
        />
      </div>

      <div>
        <h3 className="mb-3 font-display text-lg font-semibold text-foreground">
          Monthly Payment History
        </h3>

        <div className="flex flex-col gap-2">
          {visibleMonths.map((month) => (
            <div
              key={month.month}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">{formatMonthYear(month.month)}</p>
                {month.paid_on && (month.status === "paid" || month.status === "late") ? (
                  <p className="text-xs text-muted">
                    Paid on {formatFullDate(month.paid_on)}
                    {month.status === "late" && " (late)"}
                  </p>
                ) : month.status === "pending" ? (
                  <p className="text-xs text-danger">Payment pending</p>
                ) : null}
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold text-foreground">
                  {formatCurrency(month.amount)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    statusClasses[month.status]
                  )}
                >
                  {statusLabel[month.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {monthlyBreakdown.length > 6 && (
        <Button variant="ghost" onClick={() => setShowAllMonths(!showAllMonths)}>
          {showAllMonths
            ? "Show Less ↑"
            : `Show More (${monthlyBreakdown.length - 6} more months) ↓`}
        </Button>
      )}
    </div>
  );
}

function formatMonthYear(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
