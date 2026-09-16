import { cn } from "@/utils/cn";
import type { RentState } from "@/types/rent-analytics";

/**
 * How each state is drawn. On time and unpaid are green and red, which
 * protanopes can't tell apart, so unpaid is a hollow ring rather than a filled
 * dot: the shape carries the difference, not the hue. Late is a separate amber
 * validated against both (see --color-late in globals.css).
 */
const MARKS: Record<RentState | "none", { className: string; label: string }> = {
  on_time: { className: "h-2.5 w-2.5 rounded-full bg-success", label: "On time" },
  late: { className: "h-2.5 w-2.5 rounded-full bg-late", label: "Late" },
  overdue: {
    className: "h-2.5 w-2.5 rounded-full border-2 border-danger",
    label: "Unpaid",
  },
  due: { className: "h-2.5 w-2.5 rounded-full border-2 border-muted/60", label: "Not due yet" },
  none: { className: "h-0.5 w-2 rounded-full bg-border", label: "Not a tenant" },
};

export function StatusMark({ state }: { state: RentState | null }) {
  return <span aria-hidden="true" className={cn("block shrink-0", MARKS[state ?? "none"].className)} />;
}

type Props = {
  history: (RentState | null)[];
  /** Read aloud in place of the dots. */
  summary: string;
  className?: string;
};

/** One mark per month, oldest on the left. */
export default function StatusStrip({ history, summary, className }: Props) {
  return (
    <div
      role="img"
      aria-label={summary}
      className={cn("grid h-4 items-center justify-items-center", className)}
      style={{ gridTemplateColumns: `repeat(${history.length}, minmax(0, 1fr))` }}
    >
      {history.map((state, i) => (
        <StatusMark key={i} state={state} />
      ))}
    </div>
  );
}

export function StatusLegend({ className }: { className?: string }) {
  const shown: (RentState | "none")[] = ["on_time", "late", "overdue", "none"];

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted", className)}>
      {shown.map((state) => (
        <span key={state} className="flex items-center gap-1.5">
          <StatusMark state={state === "none" ? null : state} />
          {MARKS[state].label}
        </span>
      ))}
    </div>
  );
}
