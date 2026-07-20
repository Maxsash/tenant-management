"use client";

import { useEffect, useState } from "react";
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
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";

import type { ExpenseCategory, ExpenseItem } from "@/types/expense";

import styles from "@/styles/manage-items.module.css";

type Props = {
  categories: ExpenseCategory[];
};

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

  function fetchItems() {
    setLoading(true);

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

  async function handleDeleteItem(item: ExpenseItem) {
    if (!window.confirm(`Delete "${item.name}"? This can't be undone.`)) {
      return;
    }

    const res = await fetch(`/api/expense-items/${item.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(
        body.error ??
          "Couldn't delete this item — it may already have expenses logged against it. Deactivate it instead."
      );
      return;
    }

    fetchItems();
  }

  const grouped = categories
    .map((cat) => ({
      category: cat.name,
      icon: cat.icon,
      items: items.filter((i) => i.category === cat.name),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Box>
      {loading ? (
        <Typography className={styles.emptyText}>Loading…</Typography>
      ) : (
        grouped.map((group) => (
          <Box key={group.category} className={styles.group}>
            <Typography className={styles.groupTitle}>
              {group.icon} {group.category}
            </Typography>

            {group.items.map((item) => (
              <Box key={item.id} className={styles.itemRow}>
                <Box onClick={() => openEdit(item)} className={styles.itemInfo}>
                  <Typography
                    className={`${styles.itemName} ${!item.active ? styles.itemInactive : ""}`}
                  >
                    {item.name}
                  </Typography>

                  {item.default_unit && (
                    <Typography className={styles.itemUnit}>
                      per {item.default_unit}
                    </Typography>
                  )}
                </Box>

                <Box className={styles.itemActions}>
                  <Chip
                    label={item.active ? "Active" : "Inactive"}
                    size="small"
                    color={item.active ? "success" : "default"}
                    onClick={() => toggleActive(item)}
                    className={styles.statusChip}
                  />

                  <IconButton
                    size="small"
                    onClick={() => handleDeleteItem(item)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        ))
      )}

      <Fab
        color="success"
        onClick={openAdd}
        className={styles.fab}
        aria-label="Add item"
      >
        <AddIcon />
      </Fab>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>

        <DialogContent>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            margin="normal"
          />

          <TextField
            select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
            margin="normal"
          >
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.name}>
                {c.icon} {c.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Default unit (optional)"
            placeholder="L, kg, pcs..."
            value={defaultUnit}
            onChange={(e) => setDefaultUnit(e.target.value)}
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
