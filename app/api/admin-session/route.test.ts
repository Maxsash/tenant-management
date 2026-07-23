import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE, createSessionToken, getSessionLevel } from "@/lib/admin-auth";
import { GET, POST } from "./route";

const ORIGINAL_ADMIN_PIN = process.env.ADMIN_PIN;
const ORIGINAL_USER_PIN = process.env.USER_PIN;

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_ADMIN_PIN;
  process.env.USER_PIN = ORIGINAL_USER_PIN;
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
  it("sets a valid, HttpOnly admin-level session cookie when the ADMIN PIN is correct", async () => {
    process.env.ADMIN_PIN = "1234";
    process.env.USER_PIN = "5678";

    const res = await POST(makePostRequest({ pin: "1234" }));
    const body = await res.json();

    expect(body).toEqual({ ok: true, level: "admin" });

    const cookie = res.cookies.get(ADMIN_SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(getSessionLevel(cookie?.value)).toBe("admin");
  });

  it("sets a valid, HttpOnly user-level session cookie when the USER PIN is correct", async () => {
    process.env.ADMIN_PIN = "1234";
    process.env.USER_PIN = "5678";

    const res = await POST(makePostRequest({ pin: "5678" }));
    const body = await res.json();

    expect(body).toEqual({ ok: true, level: "user" });

    const cookie = res.cookies.get(ADMIN_SESSION_COOKIE);
    expect(getSessionLevel(cookie?.value)).toBe("user");
  });

  it("returns 401 and sets no cookie when the PIN matches neither tier", async () => {
    process.env.ADMIN_PIN = "1234";
    process.env.USER_PIN = "5678";

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
  it("reports level: \"admin\" for a valid admin-level session cookie", async () => {
    process.env.ADMIN_PIN = "1234";
    const token = createSessionToken("admin");

    const res = await GET(makeGetRequest(`${ADMIN_SESSION_COOKIE}=${token}`));
    const body = await res.json();

    expect(body).toEqual({ level: "admin" });
  });

  it("reports level: \"user\" for a valid user-level session cookie", async () => {
    process.env.ADMIN_PIN = "1234";
    const token = createSessionToken("user");

    const res = await GET(makeGetRequest(`${ADMIN_SESSION_COOKIE}=${token}`));
    const body = await res.json();

    expect(body).toEqual({ level: "user" });
  });

  it("reports level: null with no cookie", async () => {
    process.env.ADMIN_PIN = "1234";

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body).toEqual({ level: null });
  });
});
