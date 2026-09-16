import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTenant } from "@/test/fixtures/tenants";
import { makePayment } from "@/test/fixtures/payments";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";
import { buildWhatsAppMessage } from "@/lib/whatsapp";
import type { AdminLevel } from "@/types/admin";

vi.mock("@/lib/db", () => ({
  getTenants: vi.fn(),
  getPayments: vi.fn(),
}));

import { getPayments, getTenants } from "@/lib/db";
import { GET } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest(query: string, { level = "admin" }: { level?: AdminLevel | null } = {}) {
  return new Request(`http://localhost/api/whatsapp-links?${query}`, {
    headers: level ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken(level)}` } : {},
  });
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getTenants).mockReset();
  vi.mocked(getPayments).mockReset();
  vi.mocked(getPayments).mockResolvedValue([]);
});

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("admin session guard", () => {
  it.each([null, "user"] as const)(
    "returns 401 and never reads tenants with a %s session",
    async (level) => {
      const res = await GET(makeRequest("month=2026-06&kind=reminder", { level }));

      expect(res.status).toBe(401);
      expect(getTenants).not.toHaveBeenCalled();
    }
  );
});

describe("GET /api/whatsapp-links", () => {
  it.each(["", "month=2026-13", "month=June"])(
    "returns 400 for a missing or malformed month (%j)",
    async (query) => {
      const res = await GET(makeRequest(`${query}&kind=reminder`));

      expect(res.status).toBe(400);
      expect(getTenants).not.toHaveBeenCalled();
    }
  );

  it.each(["", "kind=broadcast"])("returns 400 for a missing or unknown kind (%j)", async (query) => {
    const res = await GET(makeRequest(`month=2026-06&${query}`));

    expect(res.status).toBe(400);
    expect(getTenants).not.toHaveBeenCalled();
  });

  it("links only pending tenants for a reminder, with the reminder text prefilled", async () => {
    const pending = makeTenant({
      id: "t1",
      name: "Asha",
      phone: "9876543210",
      base_rent: 12000,
      tenant_since: undefined,
    });
    const paid = makeTenant({ id: "t2", phone: "9876500000", tenant_since: undefined });

    vi.mocked(getTenants).mockResolvedValue([pending, paid]);
    vi.mocked(getPayments).mockResolvedValue([
      makePayment({ tenant_id: "t2", month: "2026-07", paid_on: "2026-07-03" }),
    ]);

    const res = await GET(makeRequest("month=2026-06&kind=reminder"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rent_month).toBe("2026-06");
    expect(body.kind).toBe("reminder");
    expect(body.recipients).toHaveLength(1);
    expect(body.recipients[0]).toMatchObject({ id: "t1", name: "Asha", rent: 12000 });

    const url = new URL(body.recipients[0].link);
    expect(url.pathname).toBe("/919876543210");
    expect(url.searchParams.get("text")).toBe(buildWhatsAppMessage("reminder", 12000, "2026-06"));
  });

  it("links every active tenant for a greeting, paid or not", async () => {
    const a = makeTenant({ id: "t1", phone: "9876543210", tenant_since: undefined });
    const b = makeTenant({ id: "t2", phone: "9876500000", tenant_since: undefined });

    vi.mocked(getTenants).mockResolvedValue([a, b]);
    vi.mocked(getPayments).mockResolvedValue([
      makePayment({ tenant_id: "t2", month: "2026-07", paid_on: "2026-07-03" }),
    ]);

    const res = await GET(makeRequest("month=2026-06&kind=greeting"));
    const body = await res.json();

    expect(body.recipients.map((r: { id: string }) => r.id)).toEqual(["t1", "t2"]);
    expect(new URL(body.recipients[0].link).searchParams.get("text")).toBe(
      buildWhatsAppMessage("greeting", 10000, "2026-06")
    );
  });

  it("keeps a tenant with an unusable phone, with a null link, instead of dropping them", async () => {
    vi.mocked(getTenants).mockResolvedValue([
      makeTenant({ id: "t1", phone: "", tenant_since: undefined }),
      makeTenant({ id: "t2", phone: "+91111", tenant_since: undefined }),
    ]);

    const res = await GET(makeRequest("month=2026-06&kind=reminder"));
    const body = await res.json();

    expect(body.recipients).toEqual([
      expect.objectContaining({ id: "t1", link: null }),
      expect.objectContaining({ id: "t2", link: null }),
    ]);
  });

  it("catches a thrown error and returns a 500 with the error message", async () => {
    vi.mocked(getTenants).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("month=2026-06&kind=reminder"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
