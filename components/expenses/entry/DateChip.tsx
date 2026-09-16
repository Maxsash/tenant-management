"use client";

import type { MouseEvent } from "react";
import { CalendarDays } from "lucide-react";

import { formatShortDate } from "@/utils/date";
import { cn } from "@/utils/cn";

type Props = {
  value: string;
  onChange: (date: string) => void;
  /** Read out by a screen reader in place of the visible date. */
  label: string;
  className?: string;
};

/**
 * A date that reads as a small label and opens the phone's own date picker
 * when tapped.
 *
 * The real `<input type="date">` sits invisibly over the label, so the tap
 * lands on it and iOS opens its picker natively — no custom calendar to learn.
 * A laptop browser only opens the picker from its own calendar icon, which is
 * hidden here, so a precise pointer asks for it explicitly. Its font stays at
 * 16px even though nobody sees it, because iOS zooms the page into any
 * smaller focused field.
 */
export default function DateChip({ value, onChange, label, className }: Props) {
  function openPickerOnDesktop(event: MouseEvent<HTMLInputElement>) {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    try {
      event.currentTarget.showPicker();
    } catch {
      // Older browsers: the field is still focused and editable by keyboard.
    }
  }

  return (
    <label
      className={cn(
        "relative inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-1 text-xs font-medium text-muted transition-colors hover:text-accent focus-within:text-accent",
        className
      )}
    >
      <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{value ? formatShortDate(value) : "Set date"}</span>
      <input
        type="date"
        value={value}
        aria-label={label}
        // Clearing the date is never what someone meant; a line needs one.
        onChange={(e) => e.target.value && onChange(e.target.value)}
        onClick={openPickerOnDesktop}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none text-base opacity-0"
      />
    </label>
  );
}
