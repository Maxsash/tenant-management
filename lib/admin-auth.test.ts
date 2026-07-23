import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  getSessionLevel,
  hasAdminSession,
  hasUserSession,
  isValidSessionToken,
  verifyPin,
} from "./admin-auth";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ORIGINAL_ADMIN_PIN = process.env.ADMIN_PIN;
const ORIGINAL_USER_PIN = process.env.USER_PIN;

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_ADMIN_PIN;
  process.env.USER_PIN = ORIGINAL_USER_PIN;
});

describe("verifyPin", () => {
  it("returns \"admin\" when the pin matches ADMIN_PIN", () => {
    process.env.ADMIN_PIN = "1234";
    process.env.USER_PIN = "5678";
    expect(verifyPin("1234")).toBe("admin");
  });

  it("returns \"user\" when the pin matches USER_PIN", () => {
    process.env.ADMIN_PIN = "1234";
    process.env.USER_PIN = "5678";
    expect(verifyPin("5678")).toBe("user");
  });

  it("returns \"admin\" when USER_PIN and ADMIN_PIN happen to be equal", () => {
    process.env.ADMIN_PIN = "1234";
    process.env.USER_PIN = "1234";
    expect(verifyPin("1234")).toBe("admin");
  });

  it("returns null when the pin matches neither", () => {
    process.env.ADMIN_PIN = "1234";
    process.env.USER_PIN = "5678";
    expect(verifyPin("0000")).toBeNull();
  });

  it("returns null when both PINs are unset", () => {
    delete process.env.ADMIN_PIN;
    delete process.env.USER_PIN;
    expect(verifyPin("1234")).toBeNull();
  });

  it("returns null for a non-string pin", () => {
    process.env.ADMIN_PIN = "1234";
    // @ts-expect-error exercising a non-string input from a malformed request body
    expect(verifyPin(1234)).toBeNull();
  });
});

describe("createSessionToken / getSessionLevel", () => {
  it("round-trips a freshly created admin token", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken("admin", now);
    expect(getSessionLevel(token, now)).toBe("admin");
  });

  it("round-trips a freshly created user token", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken("user", now);
    expect(getSessionLevel(token, now)).toBe("user");
  });

  it("rejects a token once its expiry has passed", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken("admin", now);
    const thirtyOneDaysLater = now + 31 * 24 * 60 * 60 * 1000;
    expect(getSessionLevel(token, thirtyOneDaysLater)).toBeNull();
  });

  it("accepts a token right up until expiry and rejects it just after", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken("admin", now);
    const thirtyDaysLater = now + 30 * 24 * 60 * 60 * 1000;
    expect(getSessionLevel(token, thirtyDaysLater - 1)).toBe("admin");
    expect(getSessionLevel(token, thirtyDaysLater)).toBeNull();
  });

  it("rejects a token whose signature was tampered with", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken("admin", now);
    const [payload] = token.split(".");
    expect(getSessionLevel(`${payload}.deadbeef`, now)).toBeNull();
  });

  it("rejects a token whose payload was tampered with (e.g. escalating user -> admin)", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken("user", now);
    const [, signature] = token.split(".");
    const forgedPayload = `admin:${now + SESSION_TTL_MS}`;
    expect(getSessionLevel(`${forgedPayload}.${signature}`, now)).toBeNull();
  });

  it("rejects a token signed under a different ADMIN_PIN", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken("admin", now);

    process.env.ADMIN_PIN = "9999";
    expect(getSessionLevel(token, now)).toBeNull();
  });

  it.each([null, undefined, "", "not-a-token", "123.456.789"])(
    "rejects malformed token %p",
    (bad) => {
      process.env.ADMIN_PIN = "1234";
      expect(getSessionLevel(bad)).toBeNull();
    }
  );

  it("rejects a token with an unrecognized level in the payload", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    // Hand-craft a token as if a third tier existed, signed correctly.
    const payload = `superadmin:${now + SESSION_TTL_MS}`;
    const signature = crypto.createHmac("sha256", "1234").update(payload).digest("hex");
    expect(getSessionLevel(`${payload}.${signature}`, now)).toBeNull();
  });
});

describe("isValidSessionToken", () => {
  it("is true for any valid, unexpired token regardless of level", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    expect(isValidSessionToken(createSessionToken("user", now), now)).toBe(true);
    expect(isValidSessionToken(createSessionToken("admin", now), now)).toBe(true);
  });

  it("is false for a missing or invalid token", () => {
    process.env.ADMIN_PIN = "1234";
    expect(isValidSessionToken(undefined)).toBe(false);
    expect(isValidSessionToken("garbage")).toBe(false);
  });
});

describe("hasUserSession / hasAdminSession", () => {
  function makeRequest(cookieHeader?: string) {
    return new Request("http://localhost/api/mark-paid", {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
  }

  it("a user-level session satisfies hasUserSession but not hasAdminSession", () => {
    process.env.ADMIN_PIN = "1234";
    const token = createSessionToken("user");
    const req = makeRequest(`${ADMIN_SESSION_COOKIE}=${token}`);
    expect(hasUserSession(req)).toBe(true);
    expect(hasAdminSession(req)).toBe(false);
  });

  it("an admin-level session satisfies both hasUserSession and hasAdminSession", () => {
    process.env.ADMIN_PIN = "1234";
    const token = createSessionToken("admin");
    const req = makeRequest(`${ADMIN_SESSION_COOKIE}=${token}`);
    expect(hasUserSession(req)).toBe(true);
    expect(hasAdminSession(req)).toBe(true);
  });

  it("returns false for both when the session cookie is one of several cookies but missing", () => {
    process.env.ADMIN_PIN = "1234";
    const req = makeRequest("foo=bar; baz=qux");
    expect(hasUserSession(req)).toBe(false);
    expect(hasAdminSession(req)).toBe(false);
  });

  it("finds the session cookie among several others", () => {
    process.env.ADMIN_PIN = "1234";
    const token = createSessionToken("admin");
    const req = makeRequest(`foo=bar; ${ADMIN_SESSION_COOKIE}=${token}; baz=qux`);
    expect(hasAdminSession(req)).toBe(true);
  });

  it("returns false for both when there is no cookie header at all", () => {
    process.env.ADMIN_PIN = "1234";
    const req = makeRequest();
    expect(hasUserSession(req)).toBe(false);
    expect(hasAdminSession(req)).toBe(false);
  });

  it("returns false for both for an expired or tampered session cookie", () => {
    process.env.ADMIN_PIN = "1234";
    const req = makeRequest(`${ADMIN_SESSION_COOKIE}=garbage`);
    expect(hasUserSession(req)).toBe(false);
    expect(hasAdminSession(req)).toBe(false);
  });
});
