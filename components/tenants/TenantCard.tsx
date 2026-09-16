"use client";

import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import WaveBand from "@/components/ui/sea/WaveBand";
import { formatShortDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { cn } from "@/utils/cn";
import type { TenantDashboardItem } from "@/types/tenant";

type Props = {
  tenant: TenantDashboardItem;
  onClick: () => void;
  onMarkPaid?: () => void;
  onChangePaidDate?: () => void;
};

export default function TenantCard({ tenant, onClick, onMarkPaid, onChangePaidDate }: Props) {
  const isPaid = tenant.paid;

  return (
    <Card
      onClick={onClick}
      className="relative isolate cursor-pointer overflow-hidden transition-transform active:scale-[0.99]"
    >
      <div className="flex">
        {/* A painted stripe down the hull, in the colour of where rent stands. */}
        <div className={cn("w-2 shrink-0", isPaid ? "bg-success" : "bg-danger")} />

        <div className="flex-1 p-5 pb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl font-semibold text-foreground">
                {tenant.name}
              </p>
              <p className="mt-0.5 text-sm text-muted">{tenant.property_type}</p>
            </div>
            <p
              className={cn(
                "font-display text-[26px] leading-tight font-semibold tabular-nums",
                isPaid ? "text-success" : "text-danger"
              )}
            >
              {formatCurrency(tenant.amount)}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {isPaid ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Paid on {tenant.paid_on ? formatShortDate(tenant.paid_on) : "—"}
                </span>

                {onChangePaidDate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangePaidDate();
                    }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Change date
                  </button>
                )}
              </div>
            ) : (
              <>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1.5 text-sm font-semibold text-danger">
                  <Clock3 className="h-4 w-4" />
                  Rent pending
                </span>

                {onMarkPaid && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkPaid();
                    }}
                  >
                    Mark as Paid
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <WaveBand
        band="far"
        water={isPaid ? "var(--color-success-soft)" : "var(--color-accent-soft)"}
        className="-bottom-5 -z-10 opacity-70"
      />
    </Card>
  );
}
