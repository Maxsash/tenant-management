"use client";

import { useCallback, useEffect, useState } from "react";

import ExpenseDashboard from "./ExpenseDashboard";
import ExpenseFormDialog from "./ExpenseFormDialog";
import type { Expense, ExpenseItem, ExpenseMonthData } from "@/types/expense";

const ENABLE_ADMIN_ACTIONS =
  process.env.NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS === "true";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function ExpenseHome() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<ExpenseMonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const fetchExpenses = useCallback(() => {
    setLoading(true);

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

  useEffect(() => {
    if (!ENABLE_ADMIN_ACTIONS) return;

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

  return (
    <main>
      <ExpenseDashboard
        data={data}
        month={month}
        onMonthChange={setMonth}
        loading={loading}
        adminEnabled={ENABLE_ADMIN_ACTIONS}
        onAdd={openAdd}
        onEditEntry={openEdit}
      />

      {ENABLE_ADMIN_ACTIONS && (
        <ExpenseFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={fetchExpenses}
          items={items}
          editingExpense={editingExpense}
        />
      )}
    </main>
  );
}
