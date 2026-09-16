import { BADGE_COLORS, BADGE_CREST, BADGE_WAVE, IconBadge, SECTION_COPY, type Section } from "./icon-badge";

export const OG_SIZE = { width: 1200, height: 630 };

/** The link preview: the harbour on a sunny morning, badge and title in the sky. */
export function OgImage({ section }: { section: Section }) {
  const { title, subtitle } = SECTION_COPY[section];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 96px 110px",
        background: "linear-gradient(180deg, #cfe8f6 0%, #e9f4f2 55%, #fdf0d5 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 70,
          right: 120,
          width: 120,
          height: 120,
          borderRadius: 999,
          background: "#ffcf5c",
          boxShadow: "0 0 0 22px rgba(255, 231, 163, 0.55)",
        }}
      />

      <svg
        width={1200}
        height={200}
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, bottom: 40 }}
      >
        <path d={BADGE_WAVE} fill={BADGE_COLORS.seaLit} />
      </svg>
      <svg
        width={1200}
        height={170}
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, bottom: 0 }}
      >
        <path d={BADGE_WAVE} fill={BADGE_COLORS.sea} />
        <path d={BADGE_CREST} fill="none" stroke={BADGE_COLORS.foam} strokeOpacity={0.7} strokeWidth={0.5} />
      </svg>

      <IconBadge section={section} size={220} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            width: 64,
            height: 6,
            borderRadius: 3,
            background: "#86621a",
          }}
        />
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            color: "#0c2e3f",
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 32, fontWeight: 500, color: "#4a6573" }}>{subtitle}</div>
      </div>
    </div>
  );
}
