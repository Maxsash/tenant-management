"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";

import type { ExpenseCategory } from "@/types/expense";

import styles from "@/styles/manage-items.module.css";

type Props = {
  categories: ExpenseCategory[];
  onChanged: () => void;
};

export default function ManageCategoriesTab({ categories, onChanged }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(
    null
  );
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

      setDialogOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(category: ExpenseCategory) {
    await fetch(`/api/expense-categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !category.active }),
    });

    onChanged();
  }

  async function handleDeleteCategory(category: ExpenseCategory) {
    if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) {
      return;
    }

    const res = await fetch(`/api/expense-categories/${category.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(
        body.error ??
          "Couldn't delete this category — it may already have items or expenses logged against it. Deactivate it instead."
      );
      return;
    }

    onChanged();
  }

  return (
    <Box>
      <Box className={styles.group}>
        {categories.map((category) => (
          <Box key={category.id} className={styles.itemRow}>
            <Box
              onClick={() => openEdit(category)}
              className={styles.itemInfo}
            >
              <Typography
                className={`${styles.itemName} ${!category.active ? styles.itemInactive : ""}`}
              >
                {category.icon} {category.name}
              </Typography>
            </Box>

            <Box className={styles.itemActions}>
              <Chip
                label={category.active ? "Active" : "Inactive"}
                size="small"
                color={category.active ? "success" : "default"}
                onClick={() => toggleActive(category)}
                className={styles.statusChip}
              />

              <IconButton
                size="small"
                onClick={() => handleDeleteCategory(category)}
                aria-label={`Delete ${category.name}`}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        ))}

        {categories.length === 0 && (
          <Typography className={styles.emptyText}>
            No categories yet.
          </Typography>
        )}
      </Box>

      <Fab
        color="success"
        onClick={openAdd}
        className={styles.fab}
        aria-label="Add category"
      >
        <AddIcon />
      </Fab>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>

        <DialogContent>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            margin="normal"
          />

          <TextField
            label="Icon (emoji)"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            fullWidth
            margin="normal"
          />

          {error && (
            <Alert severity="error" className={styles.alert}>
              {error}
            </Alert>
          )}
        </DialogContent>

        <DialogActions className={styles.dialogActions}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>

          <Button
            variant="contained"
            color="success"
            onClick={handleSave}
            disabled={saving}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
