import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { formatDeltaPct } from "@/utils/currency";
import { cn } from "@/utils/cn";

type Props = {
  /** Null when there is nothing to compare against. */
  deltaPct: number | null;
  /** Spend and unit prices read better when a rise is coloured as a warning;
   *  a quantity is just a quantity, so it stays neutral. */
  tone?: "spend" | "neutral";
  label?: string;
  className?: string;
};

/**
 * A signed change against the previous month. The arrow carries the direction
 * as well as the colour, so the meaning survives without colour vision.
 */
export default function DeltaChip({
  deltaPct,
  tone = "spend",
  label = "vs last month",
  className,
}: Props) {
  // Null means there is no percentage to state — no previous month, or a
  // previous month of zero, where the change is undefined rather than large.
  // Saying nothing is more honest than captioning the absence.
  if (deltaPct === null) return null;

  const Icon = deltaPct > 0 ? ArrowUp : deltaPct < 0 ? ArrowDown : Minus;
  const toneClass =
    tone === "neutral" || deltaPct === 0
      ? "bg-accent-soft text-accent"
      : deltaPct > 0
        ? "bg-danger-soft text-danger"
        : "bg-success-soft text-success";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        toneClass,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="tabular-nums">{formatDeltaPct(deltaPct)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
