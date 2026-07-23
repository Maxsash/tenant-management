import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTenant } from "@/test/fixtures/tenants";
import { makePayment } from "@/test/fixtures/payments";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  getTenants: vi.fn(),
  getPayments: vi.fn(),
}));

import { getPayments, getTenants } from "@/lib/db";
import { POST } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest(body: unknown, { authed = true }: { authed?: boolean } = {}) {
  return new Request("http://localhost/api/broadcast", {
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
  vi.mocked(getPayments).mockReset();
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

describe("POST /api/broadcast", () => {
  it("only includes pending tenants with a phone number as recipients", async () => {
    const pendingWithPhone = makeTenant({ id: "t1", phone: "+91111", tenant_since: undefined });
    const pendingNoPhone = makeTenant({ id: "t2", phone: "", tenant_since: undefined });
    const late = makeTenant({ id: "t3", phone: "+91333", tenant_since: undefined });

    vi.mocked(getTenants).mockResolvedValue([pendingWithPhone, pendingNoPhone, late]);
    vi.mocked(getPayments).mockResolvedValue([
      { ...makePayment({ tenant_id: "t3", month: "2026-07", paid_on: "2026-07-20" }), rent_month: "2026-06" },
    ]);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ sent: 1, failed: 0, results: [] }, { status: 200 })
    );

    await POST(makeRequest({ month: "2026-06" }));

    const fetchBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(fetchBody.recipients).toEqual([
      expect.objectContaining({ id: "t1", phone: "+91111" }),
    ]);
  });

  it("returns totalRecipients and success on a successful worker call", async () => {
    const tenant = makeTenant({ id: "t1", phone: "+91111", tenant_since: undefined });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ sent: 1, failed: 0, results: [] }, { status: 200 })
    );

    const res = await POST(makeRequest({ month: "2026-06" }));
    const body = await res.json();

    expect(body).toMatchObject({ success: true, sent: 1, totalRecipients: 1, failed: 0 });
  });

  it("derives failedResults from results when a send fails", async () => {
    const tenant = makeTenant({ id: "t1", phone: "+91111", tenant_since: undefined });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          sent: 0,
          failed: 1,
          results: [{ id: "t1", status: "failed", error: "timeout" }],
        },
        { status: 200 }
      )
    );

    const res = await POST(makeRequest({ month: "2026-06" }));
    const body = await res.json();

    expect(body.failedResults).toEqual([{ id: "t1", status: "failed", error: "timeout" }]);
  });

  it("returns a 500 with the worker response when the worker call fails", async () => {
    const tenant = makeTenant({ id: "t1", phone: "+91111", tenant_since: undefined });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "worker down" }, { status: 500 })
    );

    const res = await POST(makeRequest({ month: "2026-06" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("worker down");
  });

  it("respects a custom WHATSAPP_WORKER_URL", async () => {
    const original = process.env.WHATSAPP_WORKER_URL;
    process.env.WHATSAPP_WORKER_URL = "http://custom-worker:9999";
    vi.resetModules();

    vi.doMock("@/lib/db", () => ({
      getTenants: vi.fn().mockResolvedValue([]),
      getPayments: vi.fn().mockResolvedValue([]),
    }));

    vi.mocked(fetch).mockResolvedValue(jsonResponse({ sent: 0, failed: 0, results: [] }));

    const { POST: PostWithCustomUrl } = await import("./route");
    await PostWithCustomUrl(makeRequest({ month: "2026-06" }));

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "http://custom-worker:9999/send-broadcast"
    );

    process.env.WHATSAPP_WORKER_URL = original;
    vi.doUnmock("@/lib/db");
  });

  it("catches a thrown error and returns a 500 with the error message", async () => {
    vi.mocked(getTenants).mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest({ month: "2026-06" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
