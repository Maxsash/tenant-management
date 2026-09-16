import type { CSSProperties } from "react";

import { cn } from "@/utils/cn";
import { WAVES, type WaveBand as Band } from "./art";

/** Drawn height of each band. Fixed rather than scaled with width, so the
 *  sea keeps the same depth on a phone and across a wide card, and a boat
 *  placed against it floats at the same line everywhere. */
export const WAVE_HEIGHT: Record<Band, number> = { far: 32, mid: 38, near: 46, shore: 50 };

type Props = {
  band: Band;
  /** Fill of the water, any CSS colour. */
  water: string;
  /** Fill of the foam line along the crest, where the band has one. */
  crest?: string;
  /** One full sideways loop, e.g. "34s". Omit for still water. */
  drift?: string;
  /** One rise and fall, e.g. "9s". Omit to hold the band level. */
  heave?: string;
  lift?: string;
  /** Carry the water colour on below the wave, so a band can sit above the
   *  bottom of its scene without a gap showing underneath. */
  fillBelow?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * One band of sea. The path repeats every third of its width, so drawing it
 * at twice the width of its box and sliding it a third of the way along loops
 * with no visible seam. Positioned by the caller; purely decorative.
 */
export default function WaveBand({
  band,
  water,
  crest,
  drift,
  heave,
  lift,
  fillBelow,
  className,
  style,
}: Props) {
  const wave = WAVES[band];

  return (
    <div
      aria-hidden="true"
      // Clipped sideways only: the band is drawn wider than its box, but the
      // water carried on below it still has to show.
      className={cn(
        "pointer-events-none absolute inset-x-0 overflow-x-clip",
        heave && "animate-sea-heave",
        className
      )}
      style={{ "--heave": heave, "--lift": lift, ...style } as CSSProperties}
    >
      <div
        className={cn("w-[max(200%,60rem)] leading-none", drift && "animate-sea-drift")}
        style={{ "--drift": drift } as CSSProperties}
      >
        <svg
          viewBox={wave.viewBox}
          preserveAspectRatio="none"
          className="block w-full"
          style={{ height: WAVE_HEIGHT[band] }}
          focusable="false"
        >
          {wave.paths.map((path, i) => (
            <path key={i} d={path.d} fill={path.kind === "foam" ? (crest ?? "transparent") : water} />
          ))}
        </svg>
      </div>

      {fillBelow && (
        <div className="absolute inset-x-0 top-[calc(100%-2px)] h-[60rem]" style={{ background: water }} />
      )}
    </div>
  );
}
