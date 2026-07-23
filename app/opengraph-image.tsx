import { ImageResponse } from "next/og";
import { OgImage, OG_SIZE } from "./_metadata/og-image";

export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgImage section="hub" />, { ...size });
}
