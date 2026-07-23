"use client";

import { Calendar } from "lucide-react";
import { cn } from "@/utils/cn";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function MonthPicker({ value, onChange, className }: Props) {
  return (
    <label
      className={cn(
        "flex h-14 items-center gap-3 rounded-xl border border-border bg-surface px-4 shadow-card",
        className
      )}
    >
      <Calendar className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      <span className="sr-only">Select month</span>
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[15px] font-medium text-foreground outline-none [color-scheme:light]"
      />
    </label>
  );
}
