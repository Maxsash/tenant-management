import Card from "@/components/ui/Card";
import { formatShortDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { getCategoryIcon } from "@/lib/expense-categories";
import { cn } from "@/utils/cn";
import type { Expense, ExpenseCategory } from "@/types/expense";

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
      className={cn(
        "flex items-center gap-3 p-4",
        onClick && "cursor-pointer transition-transform active:scale-[0.99]"
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl">
        {getCategoryIcon(categories, expense.category)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          {expense.is_itemized === false ? expense.category : expense.item_name}
        </p>
        <p className="truncate text-xs text-muted">
          {formatShortDate(expense.expense_date)}
          {quantityLabel ? ` · ${quantityLabel}` : ""}
          {expense.notes ? ` · ${expense.notes}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-semibold text-foreground">{formatCurrency(expense.amount)}</span>
        <div className="flex gap-1">
          {expense.is_itemized === false && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
              Mixed
            </span>
          )}
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            {expense.payment_method}
          </span>
        </div>
      </div>
    </Card>
  );
}
