import { cn } from "@/utils/cn";

type Props = {
  values: (number | null)[];
  /** Index rendered in the accent hue; the rest recede. */
  highlightIndex: number;
  className?: string;
};

/**
 * A short strip of bars showing one item's shape over the window. Decorative
 * only — every value it encodes is also printed as text beside it, so it is
 * hidden from assistive tech rather than duplicating the reading.
 */
export default function MiniBars({ values, highlightIndex, className }: Props) {
  const max = Math.max(...values.map((v) => v ?? 0), 0);

  return (
    <div
      aria-hidden="true"
      className={cn("flex h-7 items-end gap-[3px]", className)}
    >
      {values.map((value, i) => {
        // A floor keeps a real-but-tiny value visible and gives an empty
        // month a flat tick, so the gap reads as "nothing" not "missing".
        const height = max > 0 && value ? Math.max((value / max) * 100, 8) : 3;

        return (
          <div
            key={i}
            style={{ height: `${height}%` }}
            className={cn(
              "w-1.5 rounded-t-[2px]",
              i === highlightIndex ? "bg-accent" : "bg-accent/25"
            )}
          />
        );
      })}
    </div>
  );
}
