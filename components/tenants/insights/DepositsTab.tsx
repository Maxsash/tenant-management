"use client";

import { CircleAlert, Info } from "lucide-react";

import Card from "@/components/ui/Card";
import LockedCard from "@/components/ui/LockedCard";
import StatTile from "@/components/ui/StatTile";
import { formatCompactCurrency, formatCurrency } from "@/utils/currency";
import { formatFullDate } from "@/utils/date";
import type { RentDeposits } from "@/types/rent-analytics";

type Props = {
  deposits: RentDeposits | null;
  unlocked: boolean;
  onRequestUnlock: () => void;
};

export default function DepositsTab({ deposits, unlocked, onRequestUnlock }: Props) {
  if (!unlocked || !deposits) {
    return (
      <LockedCard message="Enter the PIN to see security deposits." onUnlock={onRequestUnlock} />
    );
  }

  const largest = deposits.current[0]?.deposit ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Held"
            value={formatCompactCurrency(deposits.held)}
            helper={`${formatCurrency(deposits.held)} from current tenants`}
          />
          <StatTile
            label="Covers"
            value={deposits.heldMonths === null ? "—" : `${deposits.heldMonths} mo`}
            helper="of the whole monthly rent"
          />
        </div>
        {deposits.withoutDeposit > 0 && (
          <p className="text-sm text-muted">
            {deposits.withoutDeposit} current tenant{deposits.withoutDeposit === 1 ? " has" : "s have"} no
            deposit on record.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Current tenants</h2>
          <p className="text-sm text-muted">
            How many months of their own rent each deposit would cover.
          </p>
        </div>

        <Card className="flex flex-col gap-5 p-5">
          {deposits.current.map((row) => (
            <div key={row.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {row.deposit > 0 ? formatCurrency(row.deposit) : "None"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  // Scaled to the largest deposit so the small ones stay
                  // visible; the figure is printed beside every bar anyway.
                  style={{ width: `${largest > 0 ? (row.deposit / largest) * 100 : 0}%` }}
                />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                {row.owedExceedsDeposit ? (
                  <>
                    <CircleAlert className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                    <span className="text-danger">
                      {formatCurrency(row.owed)} not marked paid, more than the deposit
                    </span>
                  </>
                ) : row.deposit <= 0 ? (
                  "No deposit on record"
                ) : (
                  `${row.depositMonths} month${row.depositMonths === 1 ? "" : "s"} of ${formatCurrency(row.rent)} rent`
                )}
              </p>
            </div>
          ))}
        </Card>
      </section>

      {deposits.former.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">From tenants who moved out</h2>
            <p className="flex items-start gap-1.5 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              The app doesn&apos;t record refunds, so check each of these was settled.
            </p>
          </div>

          <Card className="divide-y divide-border">
            {deposits.former.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-foreground">{row.name}</span>
                  <span className="block text-xs text-muted">
                    {row.movedOutOn ? `Moved out ${formatFullDate(row.movedOutOn)}` : "Moved out"}
                  </span>
                  {row.owed > 0 && (
                    <span className="block text-xs text-danger">
                      {formatCurrency(row.owed)} rent not marked paid
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {row.deposit > 0 ? formatCurrency(row.deposit) : "None"}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
