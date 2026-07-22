import Link from "next/link";
import {
  Box,
  CircularProgress,
  Container,
  Fab,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";

import { formatCurrency } from "@/utils/currency";
import { getCategoryIcon } from "@/lib/expense-categories";
import type { Expense, ExpenseCategory, ExpenseMonthData } from "@/types/expense";
import ExpenseEntryRow from "./ExpenseEntryRow";

import styles from "@/styles/expense-dashboard.module.css";

type Props = {
  data: ExpenseMonthData | null;
  month: string;
  onMonthChange: (month: string) => void;
  loading: boolean;
  adminEnabled: boolean;
  categories: ExpenseCategory[];
  onAdd: () => void;
  onEditEntry: (expense: Expense) => void;
};

export default function ExpenseDashboard({
  data,
  month,
  onMonthChange,
  loading,
  adminEnabled,
  categories,
  onAdd,
  onEditEntry,
}: Props) {
  const total = data?.total ?? 0;
  const categoryTotals = data?.categoryTotals ?? [];
  const expenses = data?.expenses ?? [];

  return (
    <Container maxWidth="sm" className={styles.container}>
      <Box className={styles.header}>
        <Typography variant="h4" className={styles.title}>
          💰 Expenses
        </Typography>

        {adminEnabled && (
          <Link href="/expense/settings">
            <IconButton className={styles.settingsButton}>
              <SettingsIcon />
            </IconButton>
          </Link>
        )}
      </Box>

      <TextField
        type="month"
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        fullWidth
        className={styles.monthInput}
      />

      <Box className={styles.totalCard}>
        <Typography className={styles.totalLabel}>Total this month</Typography>
        <Typography className={styles.totalValue}>
          {formatCurrency(total)}
        </Typography>
      </Box>

      {loading ? (
        <Box className={styles.loader}>
          <CircularProgress size={44} />
        </Box>
      ) : (
        <>
          {categoryTotals.length > 0 && (
            <Box className={styles.breakdownCard}>
              {categoryTotals.map((c) => (
                <Box key={c.category} className={styles.breakdownRow}>
                  <Box className={styles.breakdownTop}>
                    <Typography className={styles.breakdownLabel}>
                      {getCategoryIcon(categories, c.category)} {c.category}
                    </Typography>
                    <Typography className={styles.breakdownAmount}>
                      {formatCurrency(c.amount)}
                    </Typography>
                  </Box>
                  <Box className={styles.breakdownBarTrack}>
                    <Box
                      className={styles.breakdownBarFill}
                      style={{ width: `${c.pct}%` }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <Box className={styles.section}>
            <Typography className={styles.sectionTitle}>Entries</Typography>

            {expenses.length === 0 ? (
              <Typography className={styles.emptyText}>
                No expenses logged for this month yet.
              </Typography>
            ) : (
              <Box className={styles.entryList}>
                {expenses.map((expense) => (
                  <ExpenseEntryRow
                    key={expense.id}
                    expense={expense}
                    categories={categories}
                    onClick={
                      adminEnabled ? () => onEditEntry(expense) : undefined
                    }
                  />
                ))}
              </Box>
            )}
          </Box>
        </>
      )}

      <Fab
        color="success"
        onClick={onAdd}
        className={styles.fab}
        aria-label="Add expense"
      >
        <AddIcon />
      </Fab>
    </Container>
  );
}
