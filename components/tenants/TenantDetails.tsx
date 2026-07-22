"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3 } from "lucide-react";

import Card from "@/components/ui/Card";
import PageContainer from "@/components/ui/PageContainer";
import Tabs, { TabsContent } from "@/components/ui/Tabs";
import { formatFullDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { getIncreaseDisplay } from "@/lib/rent";
import { cn } from "@/utils/cn";
import PaymentHistoryTab from "./PaymentHistoryTab";
import type { TenantDashboardItem } from "@/types/tenant";

type Props = {
  tenant: TenantDashboardItem;
  onBack: () => void;
};

export default function TenantDetails({ tenant, onBack }: Props) {
  const [activeTab, setActiveTab] = useState("details");

  const paidDate = tenant.paid_on ? formatFullDate(tenant.paid_on) : null;
  const tenantSince = tenant.tenant_since ? formatFullDate(tenant.tenant_since) : "—";
  const securityDeposit = formatCurrency(tenant.security_deposit ?? 0);
  const rentAmount = formatCurrency(tenant.amount);
  const increaseValue = getIncreaseDisplay(
    tenant.increase_type ?? "",
    tenant.increase_by ?? ""
  );

  return (
    <PageContainer className="gap-4">
      <button
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <Card className="overflow-hidden">
        <div
          className={cn(
            "p-6 text-center",
            tenant.paid ? "bg-success-soft" : "bg-danger-soft"
          )}
        >
          <p className="font-display text-2xl font-semibold text-foreground">{tenant.name}</p>
          <p className="mt-0.5 text-sm text-muted">{tenant.property_type}</p>
          <p className="mt-3 font-display text-4xl font-semibold text-foreground">
            {rentAmount}
          </p>

          <span
            className={cn(
              "mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
              tenant.paid ? "bg-success text-white" : "bg-danger text-white"
            )}
          >
            {tenant.paid ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Paid on {paidDate}
              </>
            ) : (
              <>
                <Clock3 className="h-4 w-4" />
                Payment Pending
              </>
            )}
          </span>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: "details", label: "Details" },
            { value: "history", label: "Payment History" },
          ]}
        >
          <TabsContent value="details" className="flex flex-col px-5 py-2">
            <DetailRow label="Phone" value={tenant.phone} />
            <DetailRow label="Tenant Since" value={tenantSince} />
            <DetailRow label="Security Deposit" value={securityDeposit} />
            <DetailRow label="Bank" value={tenant.bank} />
            <DetailRow label="Rent Increase Month" value={tenant.increase_month || "—"} />
            <DetailRow label="Increase" value={increaseValue} last />
          </TabsContent>

          <TabsContent value="history">
            <PaymentHistoryTab tenantId={tenant.id} />
          </TabsContent>
        </Tabs>
      </Card>
    </PageContainer>
  );
}

function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value?: string | number | null;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-4",
        !last && "border-b border-border"
      )}
    >
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[55%] text-right font-medium text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}
