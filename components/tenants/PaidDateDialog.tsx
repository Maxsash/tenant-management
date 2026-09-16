"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { changePaidOnDate, markRentPaid } from "@/services/payments";
import { currentDate } from "@/lib/date";
import { formatFullDate, formatMonthLabel } from "@/utils/date";
import type { TenantDashboardItem } from "@/types/tenant";

export type PaidDateMode = "mark" | "edit";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PaidDateMode;
  tenant: TenantDashboardItem | null;
  month: string;
  onTimeBy: string | null;
  onSaved: () => void;
};

// Asks when rent was actually paid, both when first marking it paid (today,
// unless changed) and when correcting a date already recorded. Marking often
// happens days after the money arrived, and the date decides on-time vs late.
export default function PaidDateDialog({
  open,
  onOpenChange,
  mode,
  tenant,
  month,
  onTimeBy,
  onSaved,
}: Props) {
  const [paidOn, setPaidOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const initialDate = mode === "edit" && tenant?.paid_on ? tenant.paid_on : null;

  useEffect(() => {
    if (!open) return;
    // Deferred to a microtask so the reset doesn't set state synchronously
    // within the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      setPaidOn(initialDate ?? currentDate());
      setError(null);
    });
  }, [open, initialDate]);

  async function save() {
    if (!tenant) return;

    if (!paidOn) {
      setError("Pick the date the rent was paid");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === "mark") {
        await markRentPaid(tenant.id, month, paidOn);
        toast.success(`Marked ${tenant.name}'s rent as paid on ${formatFullDate(paidOn)}`);
      } else {
        await changePaidOnDate(tenant.id, month, paidOn);
        toast.success(`${tenant.name}'s rent now shows paid on ${formatFullDate(paidOn)}`);
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      title={mode === "mark" ? "Mark rent as paid" : "Change payment date"}
      footer={
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="flex-1" loading={saving} onClick={save}>
            {mode === "mark" ? "Mark as Paid" : "Save date"}
          </Button>
        </div>
      }
    >
      {tenant && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div>
            <p className="font-display text-lg font-semibold text-foreground">{tenant.name}</p>
            <p className="text-sm text-muted">
              {formatMonthLabel(month)} rent · ₹{tenant.amount}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
              Paid on
            </label>
            <input
              id={inputId}
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none [color-scheme:light] focus:border-accent"
            />
            {onTimeBy && (
              <p className="text-sm text-muted">
                On time if paid by {formatFullDate(onTimeBy)}.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}
