"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/utils/cn";
import WaveBand from "./sea/WaveBand";

type Tone = "neutral" | "success" | "warning" | "danger";

type Props = {
  label: string;
  value: ReactNode;
  tone?: Tone;
  helper?: ReactNode;
  onClick?: () => void;
  className?: string;
};

const toneClasses: Record<Tone, string> = {
  neutral: "border-border bg-surface text-foreground",
  success: "border-success-border bg-success-soft text-success",
  warning: "border-warning-border bg-warning-soft text-warning",
  danger: "border-danger-border bg-danger-soft text-danger",
};

// Neutral tiles set their label and helper in the muted ink; a toned tile
// keeps its tone for all three, at full strength so it still reads.
const quietText: Record<Tone, string> = {
  neutral: "text-muted",
  success: "",
  warning: "",
  danger: "",
};

export default function StatTile({
  label,
  value,
  tone = "neutral",
  helper,
  onClick,
  className,
}: Props) {
  const Comp = onClick ? motion.button : motion.div;

  return (
    <Comp
      onClick={onClick}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      className={cn(
        "relative isolate flex flex-col gap-1 overflow-hidden rounded-xl border p-4 pb-5 text-left shadow-card",
        toneClasses[tone],
        onClick && "cursor-pointer",
        className
      )}
    >
      <span
        className={cn(
          "font-mono text-[11px] font-semibold tracking-[0.12em] uppercase",
          quietText[tone]
        )}
      >
        {label}
      </span>
      <span className="font-display text-[30px] font-semibold leading-none">{value}</span>
      {helper && <span className={cn("text-xs", quietText[tone])}>{helper}</span>}

      {/* A low tide line along the bottom, in the tile's own colour. */}
      <WaveBand band="far" water="currentColor" className="-bottom-3 -z-10 opacity-[0.08]" />
    </Comp>
  );
}
