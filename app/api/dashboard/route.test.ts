import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTenant } from "@/test/fixtures/tenants";
import { makePayment } from "@/test/fixtures/payments";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";

vi.mock("@/lib/db", () => ({
  getTenants: vi.fn(),
  getPayments: vi.fn(),
}));

import { getPayments, getTenants } from "@/lib/db";
import { GET } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeGetRequest(
  query = "",
  { authed = false, level = "user" as "user" | "admin" }: { authed?: boolean; level?: "user" | "admin" } = {}
) {
  return new Request(`http://localhost/api/dashboard${query}`, {
    headers: authed ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken(level)}` } : undefined,
  });
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getTenants).mockReset();
  vi.mocked(getPayments).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("GET /api/dashboard", () => {
  it("uses the explicit month query param as the rent month", async () => {
    vi.mocked(getTenants).mockResolvedValue([]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await GET(makeGetRequest("?month=2026-07"));
    const body = await res.json();

    expect(body.rent_month).toBe("2026-07");
  });

  it("defaults to the current month when no query param is given", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    vi.mocked(getTenants).mockResolvedValue([]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.rent_month).toBe("2026-07");
  });

  it("collapses both 'paid' and 'late' statuses into paid: true", async () => {
    const tenant = makeTenant({ id: "t1" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([
      { ...makePayment({ tenant_id: "t1", month: "2026-07", paid_on: "2026-07-20" }), rent_month: "2026-06" },
    ]);

    const res = await GET(makeGetRequest("?month=2026-06"));
    const body = await res.json();

    expect(body.tenants[0].paid).toBe(true);
  });

  it("returns paid: false for a pending tenant", async () => {
    const tenant = makeTenant({ id: "t1" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await GET(makeGetRequest("?month=2026-06"));
    const body = await res.json();

    expect(body.tenants[0].paid).toBe(false);
    expect(body.tenants[0].paid_on).toBeNull();
  });

  it("returns the full expected field shape, including PII, for a user-level unlocked caller", async () => {
    const tenant = makeTenant({
      id: "t1",
      name: "Asha",
      phone: "+911234567890",
      property_type: "2BHK",
      tenant_since: "2023-01-01",
      security_deposit: 20000,
      bank: "HDFC",
      increase_month: "June",
      increase_type: "flat",
      increase_by: 500,
      base_rent: 10000,
      base_rent_as_of: "2026-06-01",
    });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await GET(makeGetRequest("?month=2026-06", { authed: true, level: "user" }));
    const body = await res.json();

    expect(body.unlocked).toBe(true);
    expect(body.tenants[0]).toEqual({
      id: "t1",
      name: "Asha",
      phone: "+911234567890",
      property_type: "2BHK",
      tenant_since: "2023-01-01",
      security_deposit: 20000,
      bank: "HDFC",
      increase_month: "June",
      increase_type: "flat",
      increase_by: 500,
      amount: 10000,
      paid: false,
      paid_on: null,
    });
  });

  it("an admin-level session also unlocks PII (hierarchical)", async () => {
    const tenant = makeTenant({ id: "t1" });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await GET(makeGetRequest("?month=2026-06", { authed: true, level: "admin" }));
    const body = await res.json();

    expect(body.unlocked).toBe(true);
    expect(body.tenants[0].phone).toBeDefined();
  });

  it("omits PII fields and reports unlocked: false for a locked caller", async () => {
    const tenant = makeTenant({
      id: "t1",
      name: "Asha",
      phone: "+911234567890",
      property_type: "2BHK",
      tenant_since: "2023-01-01",
      security_deposit: 20000,
      bank: "HDFC",
      base_rent: 10000,
      base_rent_as_of: "2026-06-01",
    });
    vi.mocked(getTenants).mockResolvedValue([tenant]);
    vi.mocked(getPayments).mockResolvedValue([]);

    const res = await GET(makeGetRequest("?month=2026-06"));
    const body = await res.json();

    expect(body.unlocked).toBe(false);
    expect(body.tenants[0]).toEqual({
      id: "t1",
      name: "Asha",
      property_type: "2BHK",
      amount: 10000,
      paid: false,
      paid_on: null,
    });
  });
});
