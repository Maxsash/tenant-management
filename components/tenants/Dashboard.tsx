"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Megaphone, PartyPopper } from "lucide-react";

import Button from "@/components/ui/Button";
import MonthPicker from "@/components/ui/MonthPicker";
import StatTile from "@/components/ui/StatTile";
import Skeleton from "@/components/ui/Skeleton";
import PageContainer from "@/components/ui/PageContainer";
import TenantCard from "@/components/tenants/TenantCard";

import { sendBroadcast } from "@/services/broadcast";
import { sendMonthlyGreeting } from "@/services/monthly-greeting";
import { isAdminActionsEnabled } from "@/lib/config";
import { cn } from "@/utils/cn";
import type { TenantDashboardItem } from "@/types/tenant";

type DashboardData = {
  rent_month: string;
  tenants: TenantDashboardItem[];
};

type Props = {
  data: DashboardData | null;
  month: string;
  onMonthChange: (month: string) => void;
  loading: boolean;
  onTenantClick: (tenant: TenantDashboardItem) => void;
  onRefetch: () => void;
};

export default function Dashboard({
  data,
  month,
  onMonthChange,
  loading,
  onTenantClick,
  onRefetch,
}: Props) {
  const paid = data?.tenants.filter((t) => t.paid) ?? [];
  const unpaid = data?.tenants.filter((t) => !t.paid) ?? [];

  const unpaidRef = useRef<HTMLDivElement>(null);
  const paidRef = useRef<HTMLDivElement>(null);

  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [sendingGreeting, setSendingGreeting] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const adminEnabled = isAdminActionsEnabled();

  function scrollToSection(section: "paid" | "unpaid") {
    const ref = section === "paid" ? paidRef : unpaidRef;
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleBroadcast() {
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

  async function handleMarkPaid(tenant: TenantDashboardItem) {
    setMarkingPaidId(tenant.id);

    try {
      const res = await fetch("/api/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenant.id, month }),
      });

      if (!res.ok) throw new Error("Failed to mark as paid");

      toast.success(`Marked ${tenant.name}'s rent as paid`);
      onRefetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setMarkingPaidId(null);
    }
  }

  return (
    <PageContainer size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="font-display text-3xl font-semibold text-foreground">Tenants</h1>
          <MonthPicker value={month} onChange={onMonthChange} className="md:w-56" />
        </div>

        {adminEnabled && (
          <div className="flex flex-col gap-3 sm:flex-row">
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
          </div>
        )}
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
                    onMarkPaid={() => handleMarkPaid(tenant)}
                    markingPaid={markingPaidId === tenant.id}
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
                  <TenantCard key={tenant.id} tenant={tenant} onClick={() => onTenantClick(tenant)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
