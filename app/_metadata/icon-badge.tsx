export type Section = "hub" | "tenant" | "expense";

type IconNode =
  | { type: "path"; d: string }
  | { type: "circle"; cx: number; cy: number; r: number };

// Raw path data lifted verbatim from lucide-react's house/users/receipt
// icons (node_modules/.pnpm/lucide-react@*/dist/esm/icons/*.mjs) — the
// same glyphs already shown for these sections in Sidebar.tsx/BottomNav.tsx,
// just recolored onto a badge instead of left as bare 24x24 strokes.
const ICON_PATHS: Record<Section, IconNode[]> = {
  hub: [
    { type: "path", d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" },
    {
      type: "path",
      d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    },
  ],
  tenant: [
    { type: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
    { type: "path", d: "M16 3.128a4 4 0 0 1 0 7.744" },
    { type: "path", d: "M22 21v-2a4 4 0 0 0-3-3.87" },
    { type: "circle", cx: 9, cy: 7, r: 4 },
  ],
  expense: [
    { type: "path", d: "M12 17V7" },
    { type: "path", d: "M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" },
    {
      type: "path",
      d: "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",
    },
  ],
};

export const SECTION_COPY: Record<Section, { title: string; subtitle: string }> = {
  hub: { title: "Shrivastava Hub", subtitle: "Everything, in one place." },
  tenant: { title: "Tenants", subtitle: "Rent & payments — Shrivastava Hub" },
  expense: { title: "Expenses", subtitle: "Household spending — Shrivastava Hub" },
};

export function IconBadge({
  section,
  size,
  radius = Math.round(size * 0.22),
}: {
  section: Section;
  size: number;
  /** 0 for apple-touch-icon use — iOS applies its own corner mask, so a
   * baked-in radius there would either double up or leave a background
   * sliver showing between the two roundings. */
  radius?: number;
}) {
  const iconSize = Math.round(size * 0.52);

  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#1f5c3f",
        borderRadius: radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f7f3e8"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICON_PATHS[section].map((node, i) =>
          node.type === "path" ? (
            <path key={i} d={node.d} />
          ) : (
            <circle key={i} cx={node.cx} cy={node.cy} r={node.r} />
          )
        )}
      </svg>
    </div>
  );
}
