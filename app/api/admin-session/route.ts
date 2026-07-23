import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  hasAdminSession,
  verifyPin,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  const { pin } = await req.json().catch(() => ({ pin: undefined }));

  if (!verifyPin(pin)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}

export async function GET(req: Request) {
  return NextResponse.json({ unlocked: hasAdminSession(req) });
}
