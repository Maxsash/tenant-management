import crypto from "node:crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

function getPin(): string | undefined {
  return process.env.ADMIN_PIN;
}

export function verifyPin(pin: string): boolean {
  const expected = getPin();
  return typeof pin === "string" && !!expected && pin === expected;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getPin() ?? "").update(payload).digest("hex");
}

export function createSessionToken(now: number = Date.now()): string {
  const payload = String(now + SESSION_TTL_MS);
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionToken(
  token: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!token) return false;

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expected = sign(payload);

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (
    signatureBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return false;
  }

  const expiresAt = Number(payload);
  return !Number.isNaN(expiresAt) && now < expiresAt;
}

function parseCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return undefined;
}

export function hasAdminSession(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie") ?? "";
  return isValidSessionToken(parseCookie(cookieHeader, ADMIN_SESSION_COOKIE));
}
