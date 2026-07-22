"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/utils/cn";

type Tone = "neutral" | "success" | "warning" | "danger";

type Props = {
  label: string;
  value: ReactNode;
  tone?: Tone;
  helper?: ReactNode;
  onClick?: () => void;
};

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface text-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export default function StatTile({ label, value, tone = "neutral", helper, onClick }: Props) {
  const Comp = onClick ? motion.button : motion.div;

  return (
    <Comp
      onClick={onClick}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border p-4 text-left shadow-card",
        toneClasses[tone],
        onClick && "cursor-pointer"
      )}
    >
      <span className="text-[13px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </span>
      <span className="font-display text-[28px] font-semibold leading-none">{value}</span>
      {helper && <span className="text-xs opacity-70">{helper}</span>}
    </Comp>
  );
}
