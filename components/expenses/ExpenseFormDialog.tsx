"use client";

import { useEffect, useId, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";

import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentedControl from "@/components/ui/SegmentedControl";
import ItemPicker from "./ItemPicker";
import { PAYMENT_METHODS } from "@/lib/expense-categories";
import { currentDate } from "@/lib/date";
import { cn } from "@/utils/cn";
import type { Expense, ExpenseCategory, ExpenseItem } from "@/types/expense";

type Mode = "pick" | "custom" | "lump";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  items: ExpenseItem[];
  categories: ExpenseCategory[];
  editingExpense?: Expense | null;
};

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-foreground outline-none focus:border-accent";

const labelClass = "mb-1.5 block text-sm font-medium text-muted";

export default function ExpenseFormDialog({
  open,
  onClose,
  onSaved,
  items,
  categories,
  editingExpense,
}: Props) {
  const [expenseDate, setExpenseDate] = useState(currentDate());
  const [mode, setMode] = useState<Mode>("pick");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formId = useId();
  const ids = {
    itemName: `${formId}-item-name`,
    category: `${formId}-category`,
    amount: `${formId}-amount`,
    date: `${formId}-date`,
    quantity: `${formId}-quantity`,
    unit: `${formId}-unit`,
    notes: `${formId}-notes`,
  };

  useEffect(() => {
    if (!open) return;

    // Deferred to a microtask: this resets ~15 fields in one shot when the
    // dialog opens, so batching them synchronously in the effect body would
    // trigger cascading renders (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      setError(null);
      setConfirmingDelete(false);

      const fallbackCategory = categories[0]?.name ?? "";

      if (editingExpense) {
        setExpenseDate(editingExpense.expense_date.slice(0, 10));

        const matchedItem = editingExpense.item_id
          ? items.find((i) => i.id === editingExpense.item_id)
          : undefined;

        if (editingExpense.is_itemized === false) {
          setMode("lump");
          setSelectedItemId(null);
          setSelectedCategory(editingExpense.category);
        } else if (matchedItem) {
          setMode("pick");
          setSelectedItemId(matchedItem.id);
          setSelectedCategory(matchedItem.category);
        } else {
          setMode("custom");
          setSelectedItemId(null);
          setCustomName(editingExpense.item_name);
          setSelectedCategory(editingExpense.category);
        }

        setQuantity(
          editingExpense.quantity !== null && editingExpense.quantity !== undefined
            ? String(editingExpense.quantity)
            : ""
        );
        setUnit(editingExpense.unit ?? "");
        setAmount(String(editingExpense.amount));
        setPaymentMethod(editingExpense.payment_method);
        setNotes(editingExpense.notes ?? "");
      } else {
        setExpenseDate(currentDate());
        setMode("pick");
        setSelectedItemId(null);
        setCustomName("");
        setSelectedCategory(fallbackCategory);
        setQuantity("");
        setUnit("");
        setAmount("");
        setPaymentMethod("Cash");
        setNotes("");
      }
    });
  }, [open, editingExpense, items, categories]);

  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) : null;

  function pickItem(item: ExpenseItem) {
    setMode("pick");
    setSelectedItemId(item.id);
    setUnit(item.default_unit ?? "");
  }

  function handleModeChange(next: string) {
    const nextMode = next as Mode;
    setMode(nextMode);
    setSelectedItemId(null);

    if (!selectedCategory) {
      setSelectedCategory(categories[0]?.name ?? "");
    }
  }

  async function handleSave() {
    setError(null);

    // Lightweight checks for instant UX feedback, avoiding an unnecessary
    // round-trip. The backend re-validates and is the authoritative source
    // of truth for how a selection turns into item_name/category/is_itemized.
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    if (mode === "pick" && !selectedItemId) {
      setError("Pick an item, or switch to Other / Lump Sum");
      return;
    }

    if (mode === "custom" && !customName.trim()) {
      setError("Enter an item name");
      return;
    }

    if ((mode === "custom" || mode === "lump") && !selectedCategory) {
      setError("Pick a category");
      return;
    }

    const payload = {
      expense_date: expenseDate,
      mode,
      item_id: mode === "pick" ? selectedItemId : null,
      custom_name: mode === "custom" ? customName.trim() : null,
      category: mode === "pick" ? null : selectedCategory,
      quantity: quantity ? Number(quantity) : null,
      unit: unit || null,
      amount: numericAmount,
      payment_method: paymentMethod,
      notes: notes || null,
    };

    setSaving(true);

    try {
      const res = await fetch(
        editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses",
        {
          method: editingExpense ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save expense");
      }

      toast.success(editingExpense ? "Expense updated" : "Expense added");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingExpense) return;

    setDeleting(true);

    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete expense");

      toast.success("Expense deleted");
      setConfirmingDelete(false);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <AnimatePresence>
          {open && (
            <RadixDialog.Portal forceMount>
              <RadixDialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 28 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:bg-black/40 md:p-6"
                >
                  <RadixDialog.Content asChild forceMount>
                    <div className="flex h-full w-full flex-col bg-surface md:h-[88vh] md:max-w-2xl md:rounded-2xl md:border md:border-border md:shadow-float">
                      <header
                        className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"
                        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
                      >
                        <RadixDialog.Title className="font-display text-xl font-semibold text-foreground">
                          {editingExpense ? "Edit Expense" : "Add Expense"}
                        </RadixDialog.Title>
                        <RadixDialog.Close
                          aria-label="Close"
                          className="rounded-full p-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                        >
                          <X className="h-5 w-5" />
                        </RadixDialog.Close>
                      </header>

              <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
                <div className="mx-auto flex max-w-xl flex-col gap-8">
                  <section className="flex flex-col gap-3">
                    <SegmentedControl
                      ariaLabel="Entry mode"
                      value={mode}
                      onChange={handleModeChange}
                      options={[
                        { value: "pick", label: "🏷️ Item" },
                        { value: "custom", label: "📦 Other" },
                        { value: "lump", label: "🧺 Lump" },
                      ]}
                    />

                    {mode === "pick" &&
                      (selectedItem ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3.5">
                          <div>
                            <p className="font-semibold text-foreground">{selectedItem.name}</p>
                            <p className="text-xs text-muted">{selectedItem.category}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedItemId(null)}
                            className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-accent"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Change
                          </button>
                        </div>
                      ) : (
                        <ItemPicker categories={categories} items={items} onPick={pickItem} />
                      ))}

                    {mode === "custom" && (
                      <div className="flex flex-col gap-4">
                        <div>
                          <label htmlFor={ids.itemName} className={labelClass}>
                            Item name
                          </label>
                          <input
                            id={ids.itemName}
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label htmlFor={ids.category} className={labelClass}>
                            Category
                          </label>
                          <select
                            id={ids.category}
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className={inputClass}
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.icon} {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {mode === "lump" && (
                      <div>
                        <p className={labelClass}>Category (not itemized — just log the total)</p>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedCategory(c.name)}
                              className={cn(
                                "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                                selectedCategory === c.name
                                  ? "border-accent bg-accent text-white"
                                  : "border-border bg-surface text-foreground"
                              )}
                            >
                              {c.icon} {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="flex flex-col gap-4 border-t border-border pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor={ids.amount} className={labelClass}>
                          Amount (₹)
                        </label>
                        <input
                          id={ids.amount}
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor={ids.date} className={labelClass}>
                          Date
                        </label>
                        <input
                          id={ids.date}
                          type="date"
                          value={expenseDate}
                          onChange={(e) => setExpenseDate(e.target.value)}
                          className={cn(inputClass, "[color-scheme:light]")}
                        />
                      </div>
                    </div>

                    {mode !== "lump" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={ids.quantity} className={labelClass}>
                            Quantity (optional)
                          </label>
                          <input
                            id={ids.quantity}
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label htmlFor={ids.unit} className={labelClass}>
                            Unit
                          </label>
                          <input
                            id={ids.unit}
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            placeholder="L, kg, pcs..."
                            className={inputClass}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <p className={labelClass}>Paid via</p>
                      <SegmentedControl
                        ariaLabel="Paid via"
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        options={PAYMENT_METHODS.map((m) => ({
                          value: m,
                          label: m === "Bank Transfer" ? "Bank" : m,
                        }))}
                      />
                    </div>
                  </section>

                  <section className="border-t border-border pt-6">
                    <label htmlFor={ids.notes} className={labelClass}>
                      {mode === "lump" ? "Notes (what was in the basket?)" : "Notes (optional)"}
                    </label>
                    <textarea
                      id={ids.notes}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className={cn(inputClass, "h-auto py-2.5")}
                    />
                  </section>

                  {error && (
                    <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
                      {error}
                    </p>
                  )}
                </div>
              </div>

              <footer
                className="border-t border-border px-5 py-4 sm:px-6"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
                  {editingExpense ? (
                    <Button
                      variant="danger"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={saving}
                    >
                      Delete
                    </Button>
                  ) : (
                    <span />
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} loading={saving}>
                      Save
                    </Button>
                  </div>
                </div>
              </footer>
                    </div>
                  </RadixDialog.Content>
                </motion.div>
              </RadixDialog.Overlay>
            </RadixDialog.Portal>
          )}
        </AnimatePresence>
      </RadixDialog.Root>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this expense?"
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
