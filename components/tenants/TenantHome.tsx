"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import Dashboard from "./Dashboard";
import TenantDetails from "./TenantDetails";
import PageLoader from "@/components/ui/PageLoader";
import type { TenantDashboardItem } from "@/types/tenant";

type DashboardData = {
  rent_month: string;
  tenants: TenantDashboardItem[];
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

  const fetchDashboard = useCallback(() => {
    setLoading(true);

    fetch(`/api/dashboard?month=${month}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard fetch failed:", err);
        setLoading(false);
      });
  }, [month]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return <PageLoader />;
  }

  return (
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
            onTenantClick={setSelectedTenant}
            onRefetch={fetchDashboard}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
