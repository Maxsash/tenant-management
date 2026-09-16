import { cn } from "@/utils/cn";

type Props = {
  /** 0–100. Anything outside is clamped. */
  percent: number;
  className?: string;
};

/**
 * A single horizontal bar, marked off in quarters like a rule. Decorative:
 * every place it is used prints the figure beside it, so it is hidden from
 * assistive tech rather than read out twice.
 */
export default function ProgressBar({ percent, className }: Props) {
  const width = Math.min(Math.max(percent, 0), 100);

  return (
    <div
      aria-hidden="true"
      className={cn("relative h-2.5 overflow-hidden rounded-full bg-accent-soft", className)}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${width}%` }}
      />
      {[25, 50, 75].map((tick) => (
        <span
          key={tick}
          className="absolute inset-y-0 w-px bg-surface/80"
          style={{ left: `${tick}%` }}
        />
      ))}
    </div>
  );
}
