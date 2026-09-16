"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/utils/cn";

type Option = { value: string; label: ReactNode };

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
};

export default function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: Props) {
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 rounded-full bg-accent-soft p-1 shadow-[inset_0_1px_3px_var(--shadow-tint-soft)]",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex-1 truncate rounded-full px-2 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              active ? "text-on-accent" : "text-accent"
            )}
          >
            {active && (
              <motion.div
                layoutId={`segmented-${layoutId}`}
                className="absolute inset-0 rounded-full bg-accent bg-linear-to-b from-accent-bright to-accent shadow-[0_6px_14px_-8px_var(--shadow-tint-strong)]"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
