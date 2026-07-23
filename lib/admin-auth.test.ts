import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  hasAdminSession,
  isValidSessionToken,
  verifyPin,
} from "./admin-auth";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("verifyPin", () => {
  it("returns true when the pin matches ADMIN_PIN", () => {
    process.env.ADMIN_PIN = "1234";
    expect(verifyPin("1234")).toBe(true);
  });

  it("returns false when the pin doesn't match", () => {
    process.env.ADMIN_PIN = "1234";
    expect(verifyPin("0000")).toBe(false);
  });

  it("returns false when ADMIN_PIN is unset", () => {
    delete process.env.ADMIN_PIN;
    expect(verifyPin("1234")).toBe(false);
  });

  it("returns false for a non-string pin", () => {
    process.env.ADMIN_PIN = "1234";
    // @ts-expect-error exercising a non-string input from a malformed request body
    expect(verifyPin(1234)).toBe(false);
  });
});

describe("createSessionToken / isValidSessionToken", () => {
  it("round-trips a freshly created token as valid", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken(now);
    expect(isValidSessionToken(token, now)).toBe(true);
  });

  it("rejects a token once its expiry has passed", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken(now);
    const thirtyOneDaysLater = now + 31 * 24 * 60 * 60 * 1000;
    expect(isValidSessionToken(token, thirtyOneDaysLater)).toBe(false);
  });

  it("accepts a token right up until expiry and rejects it just after", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken(now);
    const thirtyDaysLater = now + 30 * 24 * 60 * 60 * 1000;
    expect(isValidSessionToken(token, thirtyDaysLater - 1)).toBe(true);
    expect(isValidSessionToken(token, thirtyDaysLater)).toBe(false);
  });

  it("rejects a token whose signature was tampered with", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken(now);
    const [payload] = token.split(".");
    expect(isValidSessionToken(`${payload}.deadbeef`, now)).toBe(false);
  });

  it("rejects a token whose payload was tampered with", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken(now);
    const [, signature] = token.split(".");
    const farFuture = now + 365 * 24 * 60 * 60 * 1000;
    expect(isValidSessionToken(`${farFuture}.${signature}`, now)).toBe(false);
  });

  it("rejects a token signed under a different PIN", () => {
    process.env.ADMIN_PIN = "1234";
    const now = Date.now();
    const token = createSessionToken(now);

    process.env.ADMIN_PIN = "9999";
    expect(isValidSessionToken(token, now)).toBe(false);
  });

  it.each([null, undefined, "", "not-a-token", "123.456.789"])(
    "rejects malformed token %p",
    (bad) => {
      process.env.ADMIN_PIN = "1234";
      expect(isValidSessionToken(bad)).toBe(false);
    }
  );
});

describe("hasAdminSession", () => {
  function makeRequest(cookieHeader?: string) {
    return new Request("http://localhost/api/mark-paid", {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
  }

  it("returns true when the request carries a valid session cookie", () => {
    process.env.ADMIN_PIN = "1234";
    const token = createSessionToken();
    expect(hasAdminSession(makeRequest(`${ADMIN_SESSION_COOKIE}=${token}`))).toBe(true);
  });

  it("returns true when the session cookie is one of several cookies", () => {
    process.env.ADMIN_PIN = "1234";
    const token = createSessionToken();
    expect(
      hasAdminSession(makeRequest(`foo=bar; ${ADMIN_SESSION_COOKIE}=${token}; baz=qux`))
    ).toBe(true);
  });

  it("returns false when there is no cookie header at all", () => {
    process.env.ADMIN_PIN = "1234";
    expect(hasAdminSession(makeRequest())).toBe(false);
  });

  it("returns false when the cookie header doesn't include the session cookie", () => {
    process.env.ADMIN_PIN = "1234";
    expect(hasAdminSession(makeRequest("foo=bar"))).toBe(false);
  });

  it("returns false for an expired or tampered session cookie", () => {
    process.env.ADMIN_PIN = "1234";
    expect(hasAdminSession(makeRequest(`${ADMIN_SESSION_COOKIE}=garbage`))).toBe(false);
  });
});
