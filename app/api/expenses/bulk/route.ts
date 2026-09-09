import { getExpenseItems, insertExpenses, type ExpenseInsert } from "@/lib/db";
import { deriveExpenseFields, type ExpenseMode } from "@/lib/expenses";
import type { ExpenseItem } from "@/types/expense";
import { NextResponse } from "next/server";

/**
 * Saves a whole slip in one request: one payment method, many lines, and a
 * date per line. Per line rather than per request because a photographed page
 * is routinely a running ledger covering several days — often straddling the
 * end of a month, where collapsing it onto one date would move real spending
 * into the wrong month. The top-level `expense_date` is the default for lines
 * that do not name their own.
 *
 * Creating expenses is deliberately open to everyone (see AGENTS.md), and
 * doing several at once is still creating, so this carries no PIN gate
 * either — the sensitive operations remain editing and deleting.
 *
 * Validation is all-or-nothing on purpose. A partial save would leave the
 * person holding the slip unable to tell which lines got in.
 */

/** Comfortably above the longest real slip (the July import ran to 28 lines). */
export const MAX_BULK_LINES = 100;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface BulkLineInput {
  expense_date?: string;
  mode?: string;
  item_id?: string | null;
  custom_name?: string | null;
  category?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  amount?: number | string;
  notes?: string | null;
}

export async function POST(req: Request) {
  let body;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  const { expense_date, payment_method, lines } = body ?? {};

  if (!expense_date || !payment_method) {
    return NextResponse.json(
      { error: "Missing date or payment method" },
      { status: 400 }
    );
  }

  if (!ISO_DATE.test(expense_date)) {
    return NextResponse.json({ error: "Malformed date" }, { status: 400 });
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "No lines to save" }, { status: 400 });
  }

  if (lines.length > MAX_BULK_LINES) {
    return NextResponse.json(
      { error: `That is more than ${MAX_BULK_LINES} lines — split it across two slips.` },
      { status: 400 }
    );
  }

  // Fetched once for the whole batch rather than per line.
  const items: ExpenseItem[] = (lines as BulkLineInput[]).some(
    (line) => line.mode === "pick"
  )
    ? await getExpenseItems<ExpenseItem>()
    : [];

  const rows: ExpenseInsert[] = [];

  for (const [index, line] of (lines as BulkLineInput[]).entries()) {
    const lineDate = line.expense_date ?? expense_date;

    if (!ISO_DATE.test(lineDate)) {
      return NextResponse.json(
        { error: `Line ${index + 1} has a malformed date`, lineIndex: index },
        { status: 400 }
      );
    }

    const numericAmount = Number(line.amount);

    if (!(numericAmount > 0)) {
      return NextResponse.json(
        { error: `Line ${index + 1} has no amount`, lineIndex: index },
        { status: 400 }
      );
    }

    const derived = deriveExpenseFields({
      mode: line.mode as ExpenseMode,
      item_id: line.item_id,
      custom_name: line.custom_name,
      category: line.category,
      quantity: line.quantity,
      unit: line.unit,
      items,
    });

    if ("error" in derived) {
      return NextResponse.json(
        { error: `Line ${index + 1}: ${derived.error}`, lineIndex: index },
        { status: 400 }
      );
    }

    rows.push({
      expense_date: lineDate,
      item_id: derived.item_id,
      item_name: derived.item_name,
      category: derived.category,
      quantity: derived.quantity,
      unit: derived.unit,
      amount: numericAmount,
      payment_method,
      notes: line.notes ?? null,
      is_itemized: derived.is_itemized,
    });
  }

  try {
    const created = await insertExpenses(rows);

    return NextResponse.json({ expenses: created, count: rows.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save expenses" },
      { status: 500 }
    );
  }
}
