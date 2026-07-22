"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatShortDate } from "@/utils/date";
import { isAdminActionsEnabled } from "@/lib/config";
import { cn } from "@/utils/cn";
import type { TenantDashboardItem } from "@/types/tenant";

type Props = {
  tenant: TenantDashboardItem;
  onClick: () => void;
  onMarkPaid?: () => void;
  markingPaid?: boolean;
};

export default function TenantCard({ tenant, onClick, onMarkPaid, markingPaid }: Props) {
  const isPaid = tenant.paid;
  const adminEnabled = isAdminActionsEnabled();

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer overflow-hidden transition-transform active:scale-[0.99]"
    >
      <div className="flex">
        <div className={cn("w-1.5 shrink-0", isPaid ? "bg-success" : "bg-danger")} />

        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl font-semibold text-foreground">
                {tenant.name}
              </p>
              <p className="mt-0.5 text-sm text-muted">{tenant.property_type}</p>
            </div>
            <p className={cn("text-2xl font-bold", isPaid ? "text-success" : "text-danger")}>
              ₹{tenant.amount}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {isPaid ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" />
                Paid on {tenant.paid_on ? formatShortDate(tenant.paid_on) : "—"}
              </span>
            ) : (
              <>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1.5 text-sm font-semibold text-danger">
                  <Clock3 className="h-4 w-4" />
                  Rent pending
                </span>

                {adminEnabled && (
                  <Button
                    loading={markingPaid}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkPaid?.();
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
    </Card>
  );
}
