"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Megaphone, MessageCircle, PartyPopper } from "lucide-react";

import Button from "@/components/ui/Button";
import MonthPicker from "@/components/ui/MonthPicker";
import StatTile from "@/components/ui/StatTile";
import Skeleton from "@/components/ui/Skeleton";
import PageContainer from "@/components/ui/PageContainer";
import TenantCard from "@/components/tenants/TenantCard";
import WhatsAppSendSheet from "@/components/tenants/WhatsAppSendSheet";
import PaidDateDialog, { type PaidDateMode } from "@/components/tenants/PaidDateDialog";

import { sendBroadcast } from "@/services/broadcast";
import { sendMonthlyGreeting } from "@/services/monthly-greeting";
import { isAdminActionsEnabled } from "@/lib/config";
import { cn } from "@/utils/cn";
import type { TenantDashboardItem } from "@/types/tenant";
import type { AdminLevel } from "@/types/admin";

type DashboardData = {
  rent_month: string;
  on_time_by: string | null;
  tenants: TenantDashboardItem[];
  unlocked: boolean;
};

type Props = {
  data: DashboardData | null;
  month: string;
  onMonthChange: (month: string) => void;
  loading: boolean;
  onTenantClick: (tenant: TenantDashboardItem) => void;
  onRefetch: () => void;
  promptForUnlock: (level: AdminLevel) => Promise<boolean>;
};

export default function Dashboard({
  data,
  month,
  onMonthChange,
  loading,
  onTenantClick,
  onRefetch,
  promptForUnlock,
}: Props) {
  const paid = data?.tenants.filter((t) => t.paid) ?? [];
  const unpaid = data?.tenants.filter((t) => !t.paid) ?? [];

  const unpaidRef = useRef<HTMLDivElement>(null);
  const paidRef = useRef<HTMLDivElement>(null);

  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [sendingGreeting, setSendingGreeting] = useState(false);
  // Kept apart from the open flag so the dialog still has its tenant while it
  // animates closed.
  const [paidDateTarget, setPaidDateTarget] = useState<{
    tenant: TenantDashboardItem;
    mode: PaidDateMode;
  } | null>(null);
  const [paidDateOpen, setPaidDateOpen] = useState(false);
  const [whatsAppSheetOpen, setWhatsAppSheetOpen] = useState(false);

  const adminEnabled = isAdminActionsEnabled();

  function scrollToSection(section: "paid" | "unpaid") {
    const ref = section === "paid" ? paidRef : unpaidRef;
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }

  // Recording rent payments and sending WhatsApp messages need the admin PIN
  // specifically — promptForUnlock() checks the live session itself, so
  // this only shows a dialog when actually needed.
  async function ensureUnlocked() {
    return promptForUnlock("admin");
  }

  async function handleBroadcast() {
    if (!(await ensureUnlocked())) return;

    setSendingBroadcast(true);

    try {
      const result = await sendBroadcast(month);

      if (result.failed > 0) {
        const failedResults = result.failedResults ?? [];
        const firstFailure = failedResults[0];

        console.group("Broadcast failures");
        console.error("Broadcast response", result);
        console.table(failedResults);
        console.groupEnd();

        toast.warning(`Sent ${result.sent} of ${result.totalRecipients} reminders`, {
          description: firstFailure
            ? `First failure — ${firstFailure.name || firstFailure.id || firstFailure.phone}: ${firstFailure.error || "Unknown error"}`
            : "See console for details.",
        });
      } else {
        toast.success(`Reminder sent to ${result.totalRecipients} tenant(s)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function handleMonthlyGreeting() {
    if (!(await ensureUnlocked())) return;

    setSendingGreeting(true);

    try {
      const result = await sendMonthlyGreeting(month);
      toast.success(`Monthly greeting sent to ${result.totalRecipients} tenant(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSendingGreeting(false);
    }
  }

  // Tap-to-send from the phone. Unlike the two buttons above it, this needs
  // no worker, so it isn't hidden behind isAdminActionsEnabled() — only the
  // admin PIN, same as the bulk sends.
  async function handleOpenWhatsAppSheet() {
    if (!(await ensureUnlocked())) return;
    setWhatsAppSheetOpen(true);
  }

  // Both marking paid and correcting the date go through a dialog asking
  // when the rent was actually paid — see PaidDateDialog.
  async function openPaidDateDialog(tenant: TenantDashboardItem, mode: PaidDateMode) {
    if (!(await ensureUnlocked())) return;

    setPaidDateTarget({ tenant, mode });
    setPaidDateOpen(true);
  }

  return (
    <PageContainer size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="font-display text-3xl font-semibold text-foreground">Tenants</h1>
          <MonthPicker value={month} onChange={onMonthChange} className="md:w-56" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {adminEnabled && (
            <>
              <Button
                variant="outline"
                size="lg"
                loading={sendingGreeting}
                onClick={handleMonthlyGreeting}
                className="sm:flex-1"
              >
                <PartyPopper className="h-5 w-5" />
                Send Monthly Greeting
              </Button>

              <Button
                size="lg"
                variant={unpaid.length === 0 ? "outline" : "solid"}
                className={cn("sm:flex-1", unpaid.length > 0 && "bg-warning hover:brightness-95")}
                disabled={unpaid.length === 0}
                loading={sendingBroadcast}
                onClick={handleBroadcast}
              >
                <Megaphone className="h-5 w-5" />
                Send Reminders ({unpaid.length})
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="lg"
            onClick={handleOpenWhatsAppSheet}
            className="sm:flex-1"
          >
            <MessageCircle className="h-5 w-5" />
            Message on WhatsApp
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatTile
          label="Paid"
          value={paid.length}
          tone="success"
          onClick={() => scrollToSection("paid")}
        />
        <StatTile
          label="Unpaid"
          value={unpaid.length}
          tone="danger"
          onClick={() => scrollToSection("unpaid")}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div ref={unpaidRef} className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-semibold text-danger">Pending Rent</h2>

            {unpaid.length === 0 ? (
              <p className="text-sm text-muted">Everyone&apos;s paid up for this month.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {unpaid.map((tenant) => (
                  <TenantCard
                    key={tenant.id}
                    tenant={tenant}
                    onClick={() => onTenantClick(tenant)}
                    onMarkPaid={() => openPaidDateDialog(tenant, "mark")}
                  />
                ))}
              </div>
            )}
          </div>

          <div ref={paidRef} className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-semibold text-success">Paid Rent</h2>

            {paid.length === 0 ? (
              <p className="text-sm text-muted">No payments recorded yet this month.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {paid.map((tenant) => (
                  <TenantCard
                    key={tenant.id}
                    tenant={tenant}
                    onClick={() => onTenantClick(tenant)}
                    onChangePaidDate={() => openPaidDateDialog(tenant, "edit")}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <WhatsAppSendSheet
        open={whatsAppSheetOpen}
        onOpenChange={setWhatsAppSheetOpen}
        month={month}
      />

      <PaidDateDialog
        open={paidDateOpen}
        onOpenChange={setPaidDateOpen}
        mode={paidDateTarget?.mode ?? "mark"}
        tenant={paidDateTarget?.tenant ?? null}
        month={month}
        onTimeBy={data?.on_time_by ?? null}
        onSaved={onRefetch}
      />
    </PageContainer>
  );
}
