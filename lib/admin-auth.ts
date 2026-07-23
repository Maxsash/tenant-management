import crypto from "node:crypto";
import type { AdminLevel } from "@/types/admin";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

function getUserPin(): string | undefined {
  return process.env.USER_PIN;
}

function getAdminPin(): string | undefined {
  return process.env.ADMIN_PIN;
}

/**
 * Resolves which tier a submitted PIN belongs to. Checked admin-first so a
 * misconfiguration where USER_PIN and ADMIN_PIN are equal still grants the
 * higher tier rather than silently downgrading it.
 */
export function verifyPin(pin: string): AdminLevel | null {
  if (typeof pin !== "string") return null;

  const adminPin = getAdminPin();
  if (adminPin && pin === adminPin) return "admin";

  const userPin = getUserPin();
  if (userPin && pin === userPin) return "user";

  return null;
}

// Signed with ADMIN_PIN regardless of which tier's PIN unlocked the
// session — it's used purely as a private server-side signing secret here,
// not as the credential being checked. This also means rotating ADMIN_PIN
// invalidates every outstanding session (user- and admin-level alike), which
// is the right behavior for revoking access.
function sign(payload: string): string {
  return crypto.createHmac("sha256", getAdminPin() ?? "").update(payload).digest("hex");
}

export function createSessionToken(level: AdminLevel, now: number = Date.now()): string {
  const payload = `${level}:${now + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verifies signature + expiry and returns the tier the token was issued at,
 * or null if the token is missing, tampered, malformed, or expired.
 */
export function getSessionLevel(
  token: string | null | undefined,
  now: number = Date.now()
): AdminLevel | null {
  if (!token) return null;

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expected = sign(payload);

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (
    signatureBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return null;
  }

  const colonIndex = payload.indexOf(":");
  if (colonIndex === -1) return null;

  const level = payload.slice(0, colonIndex);
  if (level !== "user" && level !== "admin") return null;

  const expiresAt = Number(payload.slice(colonIndex + 1));
  if (Number.isNaN(expiresAt) || now >= expiresAt) return null;

  return level;
}

export function isValidSessionToken(
  token: string | null | undefined,
  now: number = Date.now()
): boolean {
  return getSessionLevel(token, now) !== null;
}

function parseCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return undefined;
}

export function getRequestSessionLevel(req: Request): AdminLevel | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  return getSessionLevel(parseCookie(cookieHeader, ADMIN_SESSION_COOKIE));
}

/** True for either tier — gates USER-level actions (hierarchical: admin counts too). */
export function hasUserSession(req: Request): boolean {
  return getRequestSessionLevel(req) !== null;
}

/** True only for the admin tier — gates ADMIN-level actions. */
export function hasAdminSession(req: Request): boolean {
  return getRequestSessionLevel(req) === "admin";
}
