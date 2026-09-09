"use client";

import { useCallback, useEffect, useState } from "react";

import PageLoader from "@/components/ui/PageLoader";
import PinPromptDialog from "@/components/ui/PinPromptDialog";
import InsightsView from "./insights/InsightsView";
import { useAdminUnlock } from "@/hooks/useAdminUnlock";
import type { ExpenseAnalytics, ExpenseCategory } from "@/types/expense";

export default function ExpenseInsights() {
  const [windowMonths, setWindowMonths] = useState("6");
  const [data, setData] = useState<ExpenseAnalytics | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const { promptForUnlock, pinDialogProps } = useAdminUnlock();

  const fetchAnalytics = useCallback(() => {
    // Deferred so calling this from the effect below doesn't set state
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(() => setLoading(true));

    fetch(`/api/expense-analytics?months=${windowMonths}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ExpenseAnalytics) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Expense analytics fetch failed:", err);
        setLoading(false);
      });
  }, [windowMonths]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Categories only supply the display icons, so a failure here is cosmetic.
  useEffect(() => {
    fetch("/api/expense-categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch((err) => console.error("Expense categories fetch failed:", err));
  }, []);

  async function handleRequestUnlock() {
    if (await promptForUnlock("user")) fetchAnalytics();
  }

  if (loading && !data) return <PageLoader />;

  return (
    <>
      <InsightsView
        data={data}
        categories={categories}
        loading={loading}
        windowMonths={windowMonths}
        onWindowChange={setWindowMonths}
        onRequestUnlock={handleRequestUnlock}
      />
      <PinPromptDialog {...pinDialogProps} />
    </>
  );
}
