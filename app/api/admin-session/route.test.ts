import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE, createSessionToken, isValidSessionToken } from "@/lib/admin-auth";
import { GET, POST } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/admin-session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(cookieHeader?: string) {
  return new Request("http://localhost/api/admin-session", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

describe("POST /api/admin-session", () => {
  it("sets a valid, HttpOnly session cookie when the PIN is correct", async () => {
    process.env.ADMIN_PIN = "1234";

    const res = await POST(makePostRequest({ pin: "1234" }));
    const body = await res.json();

    expect(body).toEqual({ ok: true });

    const cookie = res.cookies.get(ADMIN_SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(isValidSessionToken(cookie?.value)).toBe(true);
  });

  it("returns 401 and sets no cookie when the PIN is incorrect", async () => {
    process.env.ADMIN_PIN = "1234";

    const res = await POST(makePostRequest({ pin: "0000" }));

    expect(res.status).toBe(401);
    expect(res.cookies.get(ADMIN_SESSION_COOKIE)).toBeUndefined();
  });

  it("returns a controlled 401 for a malformed JSON body, instead of throwing", async () => {
    process.env.ADMIN_PIN = "1234";

    const badRequest = new Request("http://localhost/api/admin-session", {
      method: "POST",
      body: "not valid json{{{",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(badRequest);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin-session", () => {
  it("reports unlocked: true for a valid session cookie", async () => {
    process.env.ADMIN_PIN = "1234";
    const token = createSessionToken();

    const res = await GET(makeGetRequest(`${ADMIN_SESSION_COOKIE}=${token}`));
    const body = await res.json();

    expect(body).toEqual({ unlocked: true });
  });

  it("reports unlocked: false with no cookie", async () => {
    process.env.ADMIN_PIN = "1234";

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body).toEqual({ unlocked: false });
  });
});
