import { ImageResponse } from "next/og";
import { IconBadge, type Section } from "@/app/_metadata/icon-badge";

const SECTIONS: Section[] = ["hub", "tenant", "expense"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  const { section } = await params;

  if (!SECTIONS.includes(section as Section)) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(<IconBadge section={section as Section} size={512} />, {
    width: 512,
    height: 512,
  });
}
