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
        "flex h-14 items-center gap-3 rounded-full border border-border bg-surface pr-5 pl-2 shadow-card transition-colors focus-within:border-accent",
        className
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Calendar className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="sr-only">Select month</span>
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[15px] font-medium text-foreground outline-none"
      />
    </label>
  );
}
