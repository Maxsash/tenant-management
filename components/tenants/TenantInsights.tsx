"use client";

import { useCallback, useEffect, useState } from "react";

import PageLoader from "@/components/ui/PageLoader";
import PinPromptDialog from "@/components/ui/PinPromptDialog";
import RentInsightsView from "./insights/RentInsightsView";
import { useAdminUnlock } from "@/hooks/useAdminUnlock";
import type { RentAnalytics } from "@/types/rent-analytics";

export default function TenantInsights() {
  const [windowMonths, setWindowMonths] = useState("12");
  const [data, setData] = useState<RentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const { promptForUnlock, pinDialogProps } = useAdminUnlock();

  const fetchAnalytics = useCallback(() => {
    // Deferred so calling this from the effect below doesn't set state
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(() => setLoading(true));

    fetch(`/api/rent-analytics?months=${windowMonths}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: RentAnalytics) => {
        setData(d);
        setFailed(false);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Rent analytics fetch failed:", err);
        setFailed(true);
        setLoading(false);
      });
  }, [windowMonths]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  async function handleRequestUnlock() {
    if (await promptForUnlock("user")) fetchAnalytics();
  }

  if (loading && !data) return <PageLoader />;

  return (
    <>
      <RentInsightsView
        data={data}
        failed={failed}
        loading={loading}
        windowMonths={windowMonths}
        onWindowChange={setWindowMonths}
        onRetry={fetchAnalytics}
        onRequestUnlock={handleRequestUnlock}
      />
      <PinPromptDialog {...pinDialogProps} />
    </>
  );
}
