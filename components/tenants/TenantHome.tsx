"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import Dashboard from "./Dashboard";
import TenantDetails from "./TenantDetails";
import PageLoader from "@/components/ui/PageLoader";
import PinPromptDialog from "@/components/ui/PinPromptDialog";
import { useAdminUnlock } from "@/hooks/useAdminUnlock";
import type { TenantDashboardItem } from "@/types/tenant";

type DashboardData = {
  rent_month: string;
  tenants: TenantDashboardItem[];
  adminUnlocked: boolean;
};

export default function TenantHome() {
  const [month, setMonth] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7);
  });

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantDashboardItem | null>(null);

  const { promptForUnlock, pinDialogProps } = useAdminUnlock();

  const loadDashboard = useCallback(async (targetMonth: string): Promise<DashboardData> => {
    const res = await fetch(`/api/dashboard?month=${targetMonth}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  const fetchDashboard = useCallback(() => {
    // Deferred to a microtask so calling this from the mount/dependency
    // effect below doesn't set state synchronously within the effect body
    // (react-hooks/set-state-in-effect).
    queueMicrotask(() => setLoading(true));

    loadDashboard(month)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard fetch failed:", err);
        setLoading(false);
      });
  }, [month, loadDashboard]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Tenant PII is only present in `data` once the caller is unlocked, so a
  // click on a still-locked dashboard prompts for the PIN and refetches
  // before opening the details view, rather than showing a page with gaps.
  async function handleTenantSelect(tenant: TenantDashboardItem) {
    if (data?.adminUnlocked) {
      setSelectedTenant(tenant);
      return;
    }

    if (!(await promptForUnlock())) return;

    try {
      const fresh = await loadDashboard(month);
      setData(fresh);
      setSelectedTenant(fresh.tenants.find((t) => t.id === tenant.id) ?? tenant);
    } catch (err) {
      console.error("Dashboard refetch failed:", err);
    }
  }

  if (loading && !data) {
    return <PageLoader />;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {selectedTenant ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
          >
            <TenantDetails tenant={selectedTenant} onBack={() => setSelectedTenant(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <Dashboard
              data={data}
              month={month}
              onMonthChange={setMonth}
              loading={loading}
              onTenantClick={handleTenantSelect}
              onRefetch={fetchDashboard}
              promptForUnlock={promptForUnlock}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <PinPromptDialog {...pinDialogProps} />
    </>
  );
}
