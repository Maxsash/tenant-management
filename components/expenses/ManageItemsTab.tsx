"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import { groupItemsByCategory } from "@/lib/expense-categories";
import { cn } from "@/utils/cn";
import type { ExpenseCategory, ExpenseItem } from "@/types/expense";

type Props = {
  categories: ExpenseCategory[];
};

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-foreground outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-muted";

export default function ManageItemsTab({ categories }: Props) {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [defaultUnit, setDefaultUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ExpenseItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  function fetchItems() {
    // Deferred to a microtask so calling this from the mount effect below
    // doesn't set state synchronously within the effect body
    // (react-hooks/set-state-in-effect).
    queueMicrotask(() => setLoading(true));

    fetch("/api/expense-items?all=true")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch items:", err);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchItems();
  }, []);

  function openAdd() {
    setEditingItem(null);
    setName("");
    setCategory(categories[0]?.name ?? "");
    setDefaultUnit("");
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(item: ExpenseItem) {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setDefaultUnit(item.default_unit ?? "");
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Enter an item name");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        editingItem ? `/api/expense-items/${editingItem.id}` : "/api/expense-items",
        {
          method: editingItem ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            category,
            default_unit: defaultUnit || null,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to save item");

      setDialogOpen(false);
      toast.success(editingItem ? "Item updated" : "Item added");
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: ExpenseItem) {
    await fetch(`/api/expense-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });

    fetchItems();
  }

  async function handleDeleteItem() {
    if (!deletingItem) return;

    setDeleting(true);

    try {
      const res = await fetch(`/api/expense-items/${deletingItem.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error ??
            "Couldn't delete this item — it may already have expenses logged against it. Deactivate it instead."
        );
      }

      toast.success("Item deleted");
      setDeletingItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  const grouped = groupItemsByCategory(categories, items);

  return (
    <div className="flex flex-col gap-5 pb-6">
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.category} className="flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-muted">
              {group.icon} {group.category}
            </p>

            {group.items.map((item) => (
              <Card key={item.id} className="flex items-center justify-between gap-3 p-4">
                <button
                  onClick={() => openEdit(item)}
                  className={cn(
                    "flex-1 text-left",
                    !item.active && "opacity-50"
                  )}
                >
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.default_unit && (
                    <p className="text-xs text-muted">per {item.default_unit}</p>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(item)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      item.active ? "bg-success-soft text-success" : "bg-border text-muted"
                    )}
                  >
                    {item.active ? "Active" : "Inactive"}
                  </button>

                  <button
                    onClick={() => setDeletingItem(item)}
                    aria-label={`Delete ${item.name}`}
                    className="rounded-full p-2 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ))
      )}

      <Button
        onClick={openAdd}
        aria-label="Add item"
        size="lg"
        className="fixed right-5 bottom-28 z-30 w-14 !p-0 rounded-full shadow-float md:right-10 md:bottom-10"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingItem ? "Edit Item" : "Add Item"}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Default unit (optional)</label>
            <input
              value={defaultUnit}
              onChange={(e) => setDefaultUnit(e.target.value)}
              placeholder="L, kg, pcs..."
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={`Delete "${deletingItem?.name}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteItem}
      />
    </div>
  );
}
