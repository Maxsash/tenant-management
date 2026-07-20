import { Box, Card, CardContent, Chip, Typography } from "@mui/material";

import { formatShortDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { getCategoryIcon } from "@/lib/expense-categories";
import type { Expense, ExpenseCategory } from "@/types/expense";

import styles from "@/styles/expense-dashboard.module.css";

type Props = {
  expense: Expense;
  categories: ExpenseCategory[];
  onClick?: () => void;
};

export default function ExpenseEntryRow({ expense, categories, onClick }: Props) {
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
        <Box className={styles.entryIcon}>
          {getCategoryIcon(categories, expense.category)}
        </Box>

        <Box className={styles.entryMain}>
          <Typography className={styles.entryName}>
            {expense.is_itemized === false ? expense.category : expense.item_name}
          </Typography>

          <Typography className={styles.entryMeta}>
            {formatShortDate(expense.expense_date)}
            {quantityLabel ? ` · ${quantityLabel}` : ""}
            {expense.notes ? ` · ${expense.notes}` : ""}
          </Typography>
        </Box>

        <Box className={styles.entryRight}>
          <Typography className={styles.entryAmount}>
            {formatCurrency(expense.amount)}
          </Typography>

          <Box className={styles.entryChips}>
            {expense.is_itemized === false && (
              <Chip
                label="🧺 Mixed"
                size="small"
                className={styles.entryChip}
              />
            )}

            <Chip
              label={expense.payment_method}
              size="small"
              className={styles.entryChip}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
