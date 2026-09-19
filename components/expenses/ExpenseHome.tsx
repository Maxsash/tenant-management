"use client";

import { useCallback, useEffect, useState } from "react";

import ExpenseDashboard from "./ExpenseDashboard";
import EntrySheet from "./entry/EntrySheet";
import PageLoader from "@/components/ui/PageLoader";
import PinPromptDialog from "@/components/ui/PinPromptDialog";
import { useAdminUnlock } from "@/hooks/useAdminUnlock";
import type {
  Expense,
  ExpenseCategory,
  ExpenseItem,
  ExpenseMonthData,
} from "@/types/expense";
import { currentMonth } from "@/lib/date";

export default function ExpenseHome() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<ExpenseMonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [suggested, setSuggested] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [scanIntent, setScanIntent] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const { promptForUnlock, pinDialogProps } = useAdminUnlock();

  const fetchExpenses = useCallback(() => {
    // Deferred to a microtask so calling this from the mount/dependency
    // effect below doesn't set state synchronously within the effect body
    // (react-hooks/set-state-in-effect).
    queueMicrotask(() => setLoading(true));

    fetch(`/api/expenses?month=${month}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Expense fetch failed:", err);
        setLoading(false);
      });
  }, [month]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Categories drive display icons for everyone, not just admins.
  useEffect(() => {
    fetch("/api/expense-categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch((err) => console.error("Expense categories fetch failed:", err));
  }, [formOpen]);

  // `suggest` also returns the most-bought items, which is what the picker
  // opens on. Refetched when the sheet closes so a just-logged item rises.
  useEffect(() => {
    fetch("/api/expense-items?suggest=true")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setSuggested(d.suggested ?? []);
      })
      .catch((err) => console.error("Expense items fetch failed:", err));
  }, [formOpen]);

  function openAdd() {
    setEditingExpense(null);
    setScanIntent(false);
    setFormOpen(true);
  }

  function openScan() {
    setEditingExpense(null);
    setScanIntent(true);
    setFormOpen(true);
  }

  // `/expense/log?scan=1` opens straight into scanning, so the page can be saved
  // to an iPhone home screen as its own icon that lands one tap from the
  // camera. Read off the URL rather than through useSearchParams, which would
  // need a Suspense boundary around this client-only tree.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("scan")) return;

    queueMicrotask(() => {
      setScanIntent(true);
      setFormOpen(true);
    });
  }, []);

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setScanIntent(false);
    setFormOpen(true);
  }

  async function handleRequestUnlock() {
    if (await promptForUnlock("user")) fetchExpenses();
  }

  if (loading && !data) {
    return <PageLoader />;
  }

  return (
    <>
      <ExpenseDashboard
        data={data}
        month={month}
        onMonthChange={setMonth}
        loading={loading}
        categories={categories}
        onAdd={openAdd}
        onScan={openScan}
        onEditEntry={openEdit}
        onRequestUnlock={handleRequestUnlock}
      />
      <EntrySheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchExpenses}
        items={items}
        categories={categories}
        suggested={suggested}
        scanIntent={scanIntent}
        editingExpense={editingExpense}
        promptForUnlock={promptForUnlock}
      />
      <PinPromptDialog {...pinDialogProps} />
    </>
  );
}
