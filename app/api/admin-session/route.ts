import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  getRequestSessionLevel,
  verifyPin,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  const { pin } = await req.json().catch(() => ({ pin: undefined }));

  const level = verifyPin(pin);

  if (!level) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, level });
  res.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(level), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}

export async function GET(req: Request) {
  return NextResponse.json({ level: getRequestSessionLevel(req) });
}
