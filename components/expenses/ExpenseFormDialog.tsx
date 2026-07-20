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
  Divider,
  IconButton,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { PAYMENT_METHODS } from "@/lib/expense-categories";
import type { Expense, ExpenseCategory, ExpenseItem } from "@/types/expense";

import styles from "@/styles/expense-form.module.css";

type Mode = "pick" | "custom" | "lump";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  items: ExpenseItem[];
  categories: ExpenseCategory[];
  editingExpense?: Expense | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseFormDialog({
  open,
  onClose,
  onSaved,
  items,
  categories,
  editingExpense,
}: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [expenseDate, setExpenseDate] = useState(today());
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

  useEffect(() => {
    if (!open) return;

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
      setExpenseDate(today());
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
  }, [open, editingExpense, items, categories]);

  const itemsByCategory = categories
    .map((c) => ({
      category: c.name,
      icon: c.icon,
      items: items.filter((i) => i.category === c.name),
    }))
    .filter((group) => group.items.length > 0);

  function pickItem(item: ExpenseItem) {
    setMode("pick");
    setSelectedItemId(item.id);
    setUnit(item.default_unit ?? "");
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    setSelectedItemId(null);

    if (!selectedCategory) {
      setSelectedCategory(categories[0]?.name ?? "");
    }
  }

  async function handleSave() {
    setError(null);

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    let item_id: string | null = null;
    let item_name = "";
    let category = "";
    let is_itemized = true;
    let finalQuantity = quantity ? Number(quantity) : null;
    let finalUnit = unit || null;

    if (mode === "pick") {
      const item = items.find((i) => i.id === selectedItemId);

      if (!item) {
        setError("Pick an item, or switch to Other / Lump Sum");
        return;
      }

      item_id = item.id;
      item_name = item.name;
      category = item.category;
    } else if (mode === "custom") {
      if (!customName.trim()) {
        setError("Enter an item name");
        return;
      }

      if (!selectedCategory) {
        setError("Pick a category");
        return;
      }

      item_name = customName.trim();
      category = selectedCategory;
    } else {
      if (!selectedCategory) {
        setError("Pick a category");
        return;
      }

      category = selectedCategory;
      item_name = `${selectedCategory} (mixed)`;
      is_itemized = false;
      finalQuantity = null;
      finalUnit = null;
    }

    const payload = {
      expense_date: expenseDate,
      item_id,
      item_name,
      category,
      quantity: finalQuantity,
      unit: finalUnit,
      amount: numericAmount,
      payment_method: paymentMethod,
      notes: notes || null,
      is_itemized,
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

      if (!res.ok) throw new Error("Failed to save expense");

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

    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete expense");

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle className={styles.title}>
        {editingExpense ? "Edit Expense" : "Add Expense"}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent className={styles.content}>
        <TextField
          type="date"
          label="Date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          fullWidth
          margin="normal"
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => v && handleModeChange(v)}
          fullWidth
          className={styles.modeToggle}
        >
          <ToggleButton value="pick">🏷️ Item</ToggleButton>
          <ToggleButton value="custom">📦 Other</ToggleButton>
          <ToggleButton value="lump">🧺 Lump Sum</ToggleButton>
        </ToggleButtonGroup>

        {mode === "pick" && (
          <>
            <Typography className={styles.sectionLabel}>Item</Typography>

            {itemsByCategory.map((group) => (
              <Box key={group.category} className={styles.chipGroup}>
                <Typography className={styles.chipGroupLabel}>
                  {group.icon} {group.category}
                </Typography>

                <Box className={styles.chipRow}>
                  {group.items.map((item) => (
                    <Chip
                      key={item.id}
                      label={item.name}
                      onClick={() => pickItem(item)}
                      color={
                        selectedItemId === item.id ? "success" : "default"
                      }
                      variant={
                        selectedItemId === item.id ? "filled" : "outlined"
                      }
                    />
                  ))}
                </Box>
              </Box>
            ))}

            {itemsByCategory.length === 0 && (
              <Typography className={styles.emptyText}>
                No catalog items yet — add some from Settings, or use Other /
                Lump Sum below.
              </Typography>
            )}
          </>
        )}

        {mode === "custom" && (
          <Box className={styles.customFields}>
            <TextField
              label="Item name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              fullWidth
              margin="normal"
            />

            <TextField
              select
              label="Category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              fullWidth
              margin="normal"
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.name}>
                  {c.icon} {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        )}

        {mode === "lump" && (
          <Box className={styles.customFields}>
            <Typography className={styles.sectionLabel}>
              Category (not itemized — just log the total)
            </Typography>

            <Box className={styles.chipRow}>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={`${c.icon} ${c.name}`}
                  onClick={() => setSelectedCategory(c.name)}
                  color={selectedCategory === c.name ? "success" : "default"}
                  variant={selectedCategory === c.name ? "filled" : "outlined"}
                />
              ))}
            </Box>
          </Box>
        )}

        {mode !== "lump" && (
          <>
            <Divider className={styles.divider} />

            <Box className={styles.row}>
              <TextField
                type="number"
                label="Quantity (optional)"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                margin="normal"
                fullWidth
              />

              <TextField
                label="Unit"
                placeholder="L, kg, pcs..."
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                margin="normal"
                fullWidth
              />
            </Box>
          </>
        )}

        <TextField
          type="number"
          label="Amount (₹)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          margin="normal"
          required
        />

        <Typography className={styles.sectionLabel}>Paid via</Typography>

        <ToggleButtonGroup
          value={paymentMethod}
          exclusive
          onChange={(_, v) => v && setPaymentMethod(v)}
          fullWidth
          className={styles.paymentToggle}
        >
          {PAYMENT_METHODS.map((m) => (
            <ToggleButton key={m} value={m}>
              {m}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <TextField
          label={
            mode === "lump" ? "Notes (what was in the basket?)" : "Notes (optional)"
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          margin="normal"
          multiline
          rows={2}
        />

        {error && (
          <Alert severity="error" className={styles.alert}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions className={styles.actions}>
        {editingExpense && (
          <Button
            color="error"
            onClick={handleDelete}
            disabled={saving}
            className={styles.deleteButton}
          >
            {confirmingDelete ? "Confirm Delete" : "Delete"}
          </Button>
        )}

        <Box className={styles.actionsRight}>
          <Button onClick={onClose} disabled={saving}>
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
        </Box>
      </DialogActions>
    </Dialog>
  );
}
