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

import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  getCategoryIcon,
} from "@/lib/expense-categories";
import type { Expense, ExpenseItem } from "@/types/expense";

import styles from "@/styles/expense-form.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  items: ExpenseItem[];
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
  editingExpense,
}: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [expenseDate, setExpenseDate] = useState(today());
  const [mode, setMode] = useState<"pick" | "custom">("pick");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<string>("Other");
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

    if (editingExpense) {
      setExpenseDate(editingExpense.expense_date.slice(0, 10));

      const matchedItem = editingExpense.item_id
        ? items.find((i) => i.id === editingExpense.item_id)
        : undefined;

      if (matchedItem) {
        setMode("pick");
        setSelectedItemId(matchedItem.id);
      } else {
        setMode("custom");
        setSelectedItemId(null);
        setCustomName(editingExpense.item_name);
        setCustomCategory(editingExpense.category);
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
      setCustomCategory("Other");
      setQuantity("");
      setUnit("");
      setAmount("");
      setPaymentMethod("Cash");
      setNotes("");
    }
  }, [open, editingExpense, items]);

  const itemsByCategory = EXPENSE_CATEGORIES.filter((c) => c !== "Other")
    .map((category) => ({
      category,
      items: items.filter((i) => i.category === category),
    }))
    .filter((group) => group.items.length > 0);

  function pickItem(item: ExpenseItem) {
    setMode("pick");
    setSelectedItemId(item.id);
    setUnit(item.default_unit ?? "");
  }

  function pickOther() {
    setMode("custom");
    setSelectedItemId(null);
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

    if (mode === "pick") {
      const item = items.find((i) => i.id === selectedItemId);

      if (!item) {
        setError("Pick an item or choose Other");
        return;
      }

      item_id = item.id;
      item_name = item.name;
      category = item.category;
    } else {
      if (!customName.trim()) {
        setError("Enter an item name");
        return;
      }

      item_name = customName.trim();
      category = customCategory;
    }

    const payload = {
      expense_date: expenseDate,
      item_id,
      item_name,
      category,
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

        <Typography className={styles.sectionLabel}>Item</Typography>

        {itemsByCategory.map((group) => (
          <Box key={group.category} className={styles.chipGroup}>
            <Typography className={styles.chipGroupLabel}>
              {getCategoryIcon(group.category)} {group.category}
            </Typography>

            <Box className={styles.chipRow}>
              {group.items.map((item) => (
                <Chip
                  key={item.id}
                  label={item.name}
                  onClick={() => pickItem(item)}
                  color={
                    mode === "pick" && selectedItemId === item.id
                      ? "success"
                      : "default"
                  }
                  variant={
                    mode === "pick" && selectedItemId === item.id
                      ? "filled"
                      : "outlined"
                  }
                />
              ))}
            </Box>
          </Box>
        ))}

        <Chip
          label="📦 Other"
          onClick={pickOther}
          color={mode === "custom" ? "success" : "default"}
          variant={mode === "custom" ? "filled" : "outlined"}
          className={styles.otherChip}
        />

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
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              fullWidth
              margin="normal"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {getCategoryIcon(c)} {c}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        )}

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
          label="Notes (optional)"
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
