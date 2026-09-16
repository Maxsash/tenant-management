import { MARK } from "./art";

/** The Maxsash Studio mark — an integral sign rigged as a mast. Takes the text colour. */
export default function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK.viewBox} className={className} aria-hidden="true" focusable="false">
      <g transform={MARK.transform} fill="currentColor">
        {MARK.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
