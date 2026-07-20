import { Box, Card, CardContent, Chip, Typography } from "@mui/material";

import { formatShortDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { getCategoryIcon } from "@/lib/expense-categories";
import type { Expense } from "@/types/expense";

import styles from "@/styles/expense-dashboard.module.css";

type Props = {
  expense: Expense;
  onClick?: () => void;
};

export default function ExpenseEntryRow({ expense, onClick }: Props) {
  const quantityLabel =
    expense.quantity !== null && expense.quantity !== undefined
      ? `${expense.quantity}${expense.unit ? ` ${expense.unit}` : ""}`
      : null;

  return (
    <Card
      onClick={onClick}
      className={`${styles.entryCard} ${onClick ? styles.entryCardClickable : ""}`}
    >
      <CardContent className={styles.entryContent}>
        <Box className={styles.entryIcon}>{getCategoryIcon(expense.category)}</Box>

        <Box className={styles.entryMain}>
          <Typography className={styles.entryName}>{expense.item_name}</Typography>

          <Typography className={styles.entryMeta}>
            {formatShortDate(expense.expense_date)}
            {quantityLabel ? ` · ${quantityLabel}` : ""}
          </Typography>
        </Box>

        <Box className={styles.entryRight}>
          <Typography className={styles.entryAmount}>
            {formatCurrency(expense.amount)}
          </Typography>

          <Chip
            label={expense.payment_method}
            size="small"
            className={styles.entryChip}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
