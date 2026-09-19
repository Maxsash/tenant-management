"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { cn } from "@/utils/cn";
import type { ExpenseCategory } from "@/types/expense";

type Props = {
  categories: ExpenseCategory[];
  loading: boolean;
  onChanged: () => Promise<void>;
};

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-background px-3.5 text-[15px] text-foreground outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-muted";

export default function ManageCategoriesTab({
  categories,
  loading,
  onChanged,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const formId = useId();
  const ids = { name: `${formId}-name`, icon: `${formId}-icon` };

  function openAdd() {
    setEditingCategory(null);
    setName("");
    setIcon("📦");
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(category: ExpenseCategory) {
    setEditingCategory(category);
    setName(category.name);
    setIcon(category.icon);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Enter a category name");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        editingCategory
          ? `/api/expense-categories/${editingCategory.id}`
          : "/api/expense-categories",
        {
          method: editingCategory ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            icon: icon.trim() || "📦",
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to save category");

      await onChanged();
      setDialogOpen(false);
      toast.success(editingCategory ? "Category updated" : "Category added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(category: ExpenseCategory) {
    setTogglingId(category.id);

    try {
      const response = await fetch(`/api/expense-categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !category.active }),
      });

      if (!response.ok) throw new Error("Failed to update category");

      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteCategory() {
    if (!deletingCategory) return;

    setDeleting(true);

    try {
      const res = await fetch(`/api/expense-categories/${deletingCategory.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error ??
            "Couldn't delete this category — it may already have items or expenses logged against it. Deactivate it instead."
        );
      }

      toast.success("Category deleted");
      await onChanged();
      setDeletingCategory(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 pb-6">
      {loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))
      ) : categories.length === 0 ? (
        <EmptyState title="No categories yet" />
      ) : (
        categories.map((category) => (
          <Card key={category.id} className="flex items-center justify-between gap-3 p-4">
            <button
              onClick={() => openEdit(category)}
              className={cn(
                "flex-1 text-left font-medium text-foreground",
                !category.active && "opacity-50"
              )}
            >
              {category.icon} {category.name}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(category)}
                disabled={togglingId === category.id}
                aria-busy={togglingId === category.id}
                className={cn(
                  "inline-flex min-w-16 items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-70",
                  category.active ? "bg-success-soft text-success" : "bg-surface-sunk text-muted"
                )}
              >
                {togglingId === category.id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                )}
                {togglingId === category.id
                  ? "Saving"
                  : category.active
                    ? "Active"
                    : "Inactive"}
              </button>

              <button
                onClick={() => setDeletingCategory(category)}
                aria-label={`Delete ${category.name}`}
                className="rounded-full p-2 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))
      )}

      <Button
        onClick={openAdd}
        aria-label="Add category"
        size="lg"
        className="fixed right-5 bottom-28 z-30 w-14 !p-0 shadow-float ring-4 ring-surface/80 md:right-10 md:bottom-10"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingCategory ? "Edit Category" : "Add Category"}
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
            <label htmlFor={ids.name} className={labelClass}>
              Name
            </label>
            <input
              id={ids.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={ids.icon} className={labelClass}>
              Icon (emoji)
            </label>
            <input
              id={ids.icon}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deletingCategory}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        title={`Delete "${deletingCategory?.name}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteCategory}
      />
    </div>
  );
}
