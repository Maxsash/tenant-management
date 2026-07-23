import { IconBadge, SECTION_COPY, type Section } from "./icon-badge";

export const OG_SIZE = { width: 1200, height: 630 };

export function OgImage({ section }: { section: Section }) {
  const { title, subtitle } = SECTION_COPY[section];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 96px",
        background: "#f7f3e8",
      }}
    >
      <IconBadge section={section} size={240} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            width: 64,
            height: 6,
            borderRadius: 3,
            background: "#b08a3e",
          }}
        />
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            color: "#1f5c3f",
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 32, fontWeight: 500, color: "#6f6a5c" }}>{subtitle}</div>
      </div>
    </div>
  );
}
