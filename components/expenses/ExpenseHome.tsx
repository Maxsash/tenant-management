"use client";

import { useCallback, useEffect, useState } from "react";

import ExpenseDashboard from "./ExpenseDashboard";
import ExpenseFormDialog from "./ExpenseFormDialog";
import PageLoader from "@/components/ui/PageLoader";
import type {
  Expense,
  ExpenseCategory,
  ExpenseItem,
  ExpenseMonthData,
} from "@/types/expense";
import { isAdminActionsEnabled } from "@/lib/config";
import { currentMonth } from "@/lib/date";

const ENABLE_ADMIN_ACTIONS = isAdminActionsEnabled();

export default function ExpenseHome() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<ExpenseMonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

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

  useEffect(() => {
    fetch("/api/expense-items")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch((err) => console.error("Expense items fetch failed:", err));
  }, [formOpen]);

  function openAdd() {
    setEditingExpense(null);
    setFormOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setFormOpen(true);
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
        adminEnabled={ENABLE_ADMIN_ACTIONS}
        categories={categories}
        onAdd={openAdd}
        onEditEntry={openEdit}
      />
      <ExpenseFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchExpenses}
        items={items}
        categories={categories}
        editingExpense={editingExpense}
      />
    </>
  );
}
