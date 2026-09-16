import type { CSSProperties } from "react";

import Mark from "./sea/Mark";
import WaveBand from "./sea/WaveBand";

/** The boat bobbing in a porthole while the page loads. */
export default function PageLoader() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5">
      <div
        aria-hidden="true"
        className="porthole relative h-28 w-28 overflow-hidden rounded-full bg-linear-to-b from-sky-high to-sky-low"
      >
        <div
          className="absolute bottom-3 left-1/2 h-16 w-16 -translate-x-1/2"
        >
          <div
            className="h-full w-full origin-[50%_86%] animate-boat-bob text-boat"
            style={{ "--heave": "2.8s" } as CSSProperties}
          >
            <Mark className="h-full w-full" />
          </div>
        </div>
        <WaveBand
          band="near"
          water="var(--color-sea)"
          crest="var(--color-foam)"
          drift="9s"
          heave="2.8s"
          lift="2px"
          fillBelow
          className="-bottom-5"
        />
      </div>
      <p className="text-sm font-medium text-muted">Getting things ready…</p>
    </div>
  );
}
