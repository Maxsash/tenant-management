import type { CSSProperties } from "react";

import { cn } from "@/utils/cn";
import Mark from "./Mark";
import WaveBand from "./WaveBand";

type Props = {
  /** Size and shape come from the caller; the scene fills whatever box it is given. */
  className?: string;
  /** Sky, sun (moon, after dark) and weather behind the water. */
  sky?: boolean;
  boat?: boolean;
  /** Colour of the nearest band, so the scene melts into whatever sits under it. */
  shore?: string;
};

/**
 * The harbour from maxsash.com: sky, three bands of sea drifting at different
 * speeds, the Maxsash boat riding between them, and a shoreline in front.
 * Decorative only, and still for anyone who has asked for reduced motion.
 */
export default function SeaScene({
  className,
  sky = true,
  boat = true,
  shore = "var(--color-background)",
}: Props) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none relative overflow-hidden", className)}>
      {sky && (
        <>
          <div className="absolute inset-0 bg-linear-to-b from-sky-high via-sky-mid to-sky-low" />

          <div
            className="absolute top-[14%] right-[12%] aspect-square h-[22%] min-h-10 rounded-full bg-sun"
            style={{
              boxShadow:
                "0 0 0 10px color-mix(in oklab, var(--color-sun-glow) 45%, transparent), 0 0 70px 26px var(--color-sun-glow)",
            }}
          />

          {/* Fair-weather clouds and gulls by day… */}
          <div className="dark:hidden">
            <Cloud className="top-[18%] left-[8%] w-24 animate-float" />
            <Cloud className="top-[34%] left-[46%] w-16 animate-float opacity-80 [animation-delay:-4s]" />
            {/* Wide screens only: on a phone the title fills this part of the sky. */}
            <Gull className="top-[20%] left-[56%] hidden w-6 animate-float [animation-delay:-2s] sm:block" />
            <Gull className="top-[28%] left-[61%] hidden w-4 animate-float [animation-delay:-6s] sm:block" />
          </div>

          {/* …and a few quiet stars by night. */}
          <div className="hidden dark:block">
            {STARS.map((star, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-sun"
                style={{ ...star, width: 2, height: 2, opacity: 0.7 } as CSSProperties}
              />
            ))}
          </div>
        </>
      )}

      <WaveBand
        band="far"
        water="var(--color-shallow)"
        drift="58s"
        heave="13s"
        lift="3px"
        fillBelow
        className="bottom-[34%] z-[1] opacity-90"
      />
      <WaveBand
        band="mid"
        water="var(--color-sea-lit)"
        crest="color-mix(in oklab, var(--color-shallow) 70%, white)"
        drift="34s"
        heave="9.5s"
        lift="4px"
        fillBelow
        className="bottom-[22%] z-[2]"
      />

      {boat && (
        <div
          // Measured from the near band (bottom 8%, see WAVE_HEIGHT) so the hull
          // sits in its crest at any scene height.
          className="absolute right-[7%] bottom-[calc(8%+18px)] z-[3] aspect-square h-[44%] max-h-36 origin-[50%_86%] animate-boat-bob text-boat"
          style={{ "--heave": "7s", filter: "drop-shadow(0 10px 14px var(--shadow-tint))" } as CSSProperties}
        >
          <Mark className="h-full w-full" />
        </div>
      )}

      <WaveBand
        band="near"
        water="var(--color-sea)"
        crest="var(--color-foam)"
        drift="20s"
        heave="7s"
        lift="5px"
        fillBelow
        className="bottom-[8%] z-[4]"
      />
      <WaveBand
        band="shore"
        water={shore}
        drift="38s"
        heave="9.8s"
        lift="2px"
        fillBelow
        className="-bottom-[9%] z-[5]"
      />
    </div>
  );
}

// Kept to the right-hand sky, clear of any title laid over the left.
const STARS = [
  { top: "7%", left: "58%" },
  { top: "4%", left: "70%" },
  { top: "9%", left: "93%" },
  { top: "40%", left: "95%" },
  { top: "44%", left: "66%" },
];

function Cloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 24" className={cn("absolute", className)} focusable="false">
      <path
        d="M10 22h44a8 8 0 0 0 0-16 11 11 0 0 0-20-3 9 9 0 0 0-15 6A7 7 0 0 0 10 22z"
        fill="white"
        opacity="0.85"
      />
    </svg>
  );
}

function Gull({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 10" className={cn("absolute text-foreground/55", className)} focusable="false">
      <path
        d="M1 8c3-5 7-6 11-1 4-5 8-4 11 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
