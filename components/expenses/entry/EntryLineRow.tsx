"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, StickyNote, X } from "lucide-react";

import DateChip from "./DateChip";
import { describeReviewReasons, type EntryLine } from "@/lib/entry-lines";
import { getCategoryIcon } from "@/lib/expense-categories";
import { cn } from "@/utils/cn";
import type { ExpenseCategory } from "@/types/expense";

type Props = {
  line: EntryLine;
  categories: ExpenseCategory[];
  /** Set when this line failed the pre-save check. */
  problem?: string | null;
  onChange: (patch: Partial<EntryLine>) => void;
  /** Kept apart from onChange because moving a line to another day also
   *  settles a scan's doubt about its date. */
  onChangeDate: (date: string) => void;
  onChooseItem: () => void;
  onRemove?: () => void;
  autoFocusAmount?: boolean;
};

const fieldClass =
  "h-11 rounded-xl border border-border bg-background px-3 text-[15px] text-foreground outline-none focus:border-accent";

/**
 * One line of the basket, laid out so a whole line fits on a phone without
 * scrolling: what it was on top, then quantity, unit and amount side by side
 * underneath. The amount is the last field and the widest, because it is the
 * one field every line must have.
 *
 * Every line carries its own date as a small label under the fields. It used
 * to appear only once a basket already spanned several days, which left no way
 * to type a running page in by hand, or to split a scan that had put the whole
 * page on one day — so both got saved one day at a time instead.
 */
export default function EntryLineRow({
  line,
  categories,
  problem,
  onChange,
  onChangeDate,
  onChooseItem,
  onRemove,
  autoFocusAmount,
}: Props) {
  const warnings = describeReviewReasons(line);
  const isLump = line.mode === "lump";
  const amountRef = useRef<HTMLInputElement>(null);
  // A lump sum is meaningless without saying what was in it; an itemised line
  // usually needs no note, so its field stays behind a tap.
  const [showNote, setShowNote] = useState(
    line.mode === "lump" || Boolean(line.notes)
  );

  // The row already exists by the time an item is chosen for it, so `autoFocus`
  // would never fire — jumping the caret to the amount is what makes picking
  // an item and typing its price one uninterrupted motion.
  useEffect(() => {
    if (autoFocusAmount) amountRef.current?.focus();
  }, [autoFocusAmount]);

  return (
    <li
      className={cn(
        "rounded-2xl border bg-surface p-3 shadow-card",
        problem ? "border-danger" : warnings.length > 0 ? "border-warning-border" : "border-border"
      )}
    >
      <div className="flex items-center gap-2">
        {isLump ? (
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Category for this lump sum</span>
            <select
              value={line.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className={cn(fieldClass, "w-full")}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.icon} {c.name} — not itemised
                </option>
              ))}
            </select>
          </label>
        ) : (
          <button
            type="button"
            onClick={onChooseItem}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 text-left transition-colors hover:bg-accent-soft"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base"
            >
              {line.item_name ? getCategoryIcon(categories, line.category) : "＋"}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate font-medium",
                  line.item_name ? "text-foreground" : "text-muted"
                )}
              >
                {line.item_name || "Choose item…"}
              </span>
              {line.item_name && (
                <span className="block truncate text-xs text-muted">
                  {line.category}
                  {line.mode === "custom" && " · one-off"}
                </span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${line.item_name || "this line"}`}
            className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {!isLump && (
          <>
            <input
              type="text"
              inputMode="decimal"
              value={line.quantity}
              onChange={(e) => onChange({ quantity: e.target.value })}
              placeholder="Qty"
              aria-label={`Quantity for ${line.item_name || "this line"}`}
              className={cn(fieldClass, "w-16 shrink-0 text-center")}
            />
            <input
              type="text"
              value={line.unit}
              onChange={(e) => onChange({ unit: e.target.value })}
              placeholder="unit"
              aria-label={`Unit for ${line.item_name || "this line"}`}
              className={cn(fieldClass, "w-20 shrink-0 text-center")}
            />
          </>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-border bg-background pl-3 focus-within:border-accent">
          <span aria-hidden="true" className="shrink-0 text-[15px] text-muted">
            ₹
          </span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={line.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0"
            aria-label={`Amount for ${line.item_name || "this line"}`}
            className="h-11 w-full min-w-0 rounded-r-xl bg-transparent pr-3 text-right text-[15px] font-semibold text-foreground tabular-nums outline-none"
          />
        </div>
      </div>

      {showNote && (
        <input
          type="text"
          value={line.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={
            isLump ? "What was in it?" : "Note (what the slip said, or anything else)"
          }
          aria-label={`Note for ${line.item_name || "this line"}`}
          className={cn(fieldClass, "mt-2 w-full text-sm")}
        />
      )}

      <div className="mt-1 flex items-center gap-4">
        <DateChip
          value={line.date}
          onChange={onChangeDate}
          label={`Date for ${line.item_name || "this line"}`}
          className={cn(line.reviewReasons.includes("date-check") && "text-warning")}
        />

        {!showNote && (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="flex min-h-8 items-center gap-1.5 px-1 text-xs font-medium text-muted transition-colors hover:text-accent"
          >
            <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
            Add a note
          </button>
        )}
      </div>

      {(problem || warnings.length > 0) && (
        <p
          className={cn(
            "mt-2 flex items-start gap-1.5 px-1 text-xs",
            problem ? "text-danger" : "text-warning"
          )}
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{problem ?? warnings.join(" · ")}</span>
        </p>
      )}
    </li>
  );
}
