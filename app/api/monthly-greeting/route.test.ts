import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTenant } from "@/test/fixtures/tenants";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  getTenants: vi.fn(),
}));

import { getTenants } from "@/lib/db";
import { POST } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest(body: unknown, { authed = true }: { authed?: boolean } = {}) {
  return new Request("http://localhost/api/monthly-greeting", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(authed ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken()}` } : {}),
    },
  });
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init);
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getTenants).mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("admin session guard", () => {
  it("returns 401 and never reaches the WhatsApp worker without a valid session", async () => {
    const res = await POST(makeRequest({ month: "2026-06" }, { authed: false }));

    expect(res.status).toBe(401);
    expect(getTenants).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/monthly-greeting", () => {
  it("includes ALL active tenants with a phone, regardless of payment status", async () => {
    const tenant = makeTenant({ id: "t1", phone: "+91111", tenant_since: undefined });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ sent: 1, results: [] }, { status: 200 })
    );

    await POST(makeRequest({ month: "2026-06" }));

    const fetchBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(fetchBody.recipients).toEqual([
      expect.objectContaining({ id: "t1", phone: "+91111" }),
    ]);
  });

  it("excludes tenants with no phone number", async () => {
    const tenant = makeTenant({ id: "t1", phone: "", tenant_since: undefined });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ sent: 0, results: [] }));

    await POST(makeRequest({ month: "2026-06" }));

    const fetchBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(fetchBody.recipients).toEqual([]);
  });

  it("returns totalRecipients on a successful worker call", async () => {
    const tenant = makeTenant({ id: "t1", phone: "+91111", tenant_since: undefined });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ sent: 1, results: [] }, { status: 200 })
    );

    const res = await POST(makeRequest({ month: "2026-06" }));
    const body = await res.json();

    expect(body).toMatchObject({ success: true, sent: 1, totalRecipients: 1 });
  });

  it("returns a 500 when the worker call fails", async () => {
    const tenant = makeTenant({ id: "t1", phone: "+91111", tenant_since: undefined });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "worker down" }, { status: 500 })
    );

    const res = await POST(makeRequest({ month: "2026-06" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("worker down");
  });

  it("catches a thrown error and returns a 500 with the error message", async () => {
    vi.mocked(getTenants).mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest({ month: "2026-06" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
