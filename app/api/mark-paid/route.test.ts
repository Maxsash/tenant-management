import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePayment } from "@/test/fixtures/payments";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";
import type { AdminLevel } from "@/types/admin";

vi.mock("@/lib/db", () => ({
  getPayments: vi.fn(),
  insertPayment: vi.fn(),
  updatePaymentPaidOn: vi.fn(),
}));

import { getPayments, insertPayment, updatePaymentPaidOn } from "@/lib/db";
import { PATCH, POST } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

// Server clock for every test: 16 Sep 2026, midday UTC.
const NOW = new Date("2026-09-16T12:00:00Z");

function makeRequest(
  method: "POST" | "PATCH",
  body: unknown,
  { level = "admin" }: { level?: AdminLevel | null } = {}
) {
  return new Request("http://localhost/api/mark-paid", {
    method,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(level ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken(level)}` } : {}),
    },
  });
}

function malformedJsonRequest(method: "POST" | "PATCH") {
  return new Request("http://localhost/api/mark-paid", {
    method,
    body: "not valid json{{{",
    headers: {
      "Content-Type": "application/json",
      cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken("admin")}`,
    },
  });
}

/** A stored payment row, as lib/db.ts#getPayments returns it. */
function storedPayment(overrides: Parameters<typeof makePayment>[0] & { rent_month: string }) {
  return { ...makePayment(overrides), rent_month: overrides.rent_month };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getPayments).mockReset();
  vi.mocked(insertPayment).mockReset();
  vi.mocked(updatePaymentPaidOn).mockReset();
  vi.mocked(getPayments).mockResolvedValue([]);
  vi.mocked(insertPayment).mockResolvedValue(undefined);
  vi.mocked(updatePaymentPaidOn).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  process.env.ADMIN_PIN = ORIGINAL_PIN;
});

describe("admin session guard", () => {
  it.each([
    ["POST", null],
    ["POST", "user"],
    ["PATCH", null],
    ["PATCH", "user"],
  ] as const)("%s returns 401 and doesn't touch the DB with a %s session", async (method, level) => {
    const handler = method === "POST" ? POST : PATCH;

    const res = await handler(
      makeRequest(method, { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-03" }, { level })
    );

    expect(res.status).toBe(401);
    expect(getPayments).not.toHaveBeenCalled();
    expect(insertPayment).not.toHaveBeenCalled();
    expect(updatePaymentPaidOn).not.toHaveBeenCalled();
  });
});

describe("POST /api/mark-paid", () => {
  it("converts the rent month to a payment month and inserts the payment", async () => {
    const res = await POST(
      makeRequest("POST", { tenant_id: "t1", month: "2026-06", paid_on: "2026-07-03" })
    );
    const body = await res.json();

    expect(insertPayment).toHaveBeenCalledWith({
      tenant_id: "t1",
      month: "2026-07",
      paid_on: "2026-07-03",
    });
    expect(body).toEqual({ ok: true });
  });

  it("records a back-dated payment exactly as given", async () => {
    const res = await POST(
      makeRequest("POST", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-02" })
    );

    expect(res.status).toBe(200);
    expect(insertPayment).toHaveBeenCalledWith({
      tenant_id: "t1",
      month: "2026-09",
      paid_on: "2026-09-02",
    });
  });

  it.each([undefined, ""])(
    "stamps paid_on with the server's current date when the client sends %j",
    async (paid_on) => {
      await POST(makeRequest("POST", { tenant_id: "t1", month: "2026-08", paid_on }));

      expect(insertPayment).toHaveBeenCalledWith(
        expect.objectContaining({ paid_on: "2026-09-16" })
      );
    }
  );

  it("accepts tomorrow's date, which is often today in India", async () => {
    const res = await POST(
      makeRequest("POST", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-17" })
    );

    expect(res.status).toBe(200);
    expect(insertPayment).toHaveBeenCalled();
  });

  it("rejects a duplicate payment for the same tenant/rent_month without inserting", async () => {
    vi.mocked(getPayments).mockResolvedValue([
      storedPayment({ id: 7, tenant_id: "t1", month: "2026-07", rent_month: "2026-06" }),
    ]);

    const res = await POST(
      makeRequest("POST", { tenant_id: "t1", month: "2026-06", paid_on: "2026-07-03" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Already marked paid" });
    expect(insertPayment).not.toHaveBeenCalled();
    expect(updatePaymentPaidOn).not.toHaveBeenCalled();
  });

  it("fills in an existing row with no paid_on instead of inserting a duplicate", async () => {
    vi.mocked(getPayments).mockResolvedValue([
      storedPayment({ id: 7, tenant_id: "t1", month: "2026-09", paid_on: null, rent_month: "2026-08" }),
    ]);

    const res = await POST(
      makeRequest("POST", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-04" })
    );

    expect(res.status).toBe(200);
    expect(updatePaymentPaidOn).toHaveBeenCalledWith(7, "2026-09-04");
    expect(insertPayment).not.toHaveBeenCalled();
  });

  it("isn't blocked by another tenant's payment, or the same tenant's other months", async () => {
    vi.mocked(getPayments).mockResolvedValue([
      storedPayment({ id: 1, tenant_id: "t2", month: "2026-09", rent_month: "2026-08" }),
      storedPayment({ id: 2, tenant_id: "t1", month: "2026-08", rent_month: "2026-07" }),
    ]);

    const res = await POST(
      makeRequest("POST", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-04" })
    );

    expect(res.status).toBe(200);
    expect(insertPayment).toHaveBeenCalledWith({
      tenant_id: "t1",
      month: "2026-09",
      paid_on: "2026-09-04",
    });
  });

  describe("validation and error handling", () => {
    it.each([
      ["tenant_id", { month: "2026-06", paid_on: "2026-07-03" }],
      ["month", { tenant_id: "t1", paid_on: "2026-07-03" }],
    ])("returns 400 when %s is missing", async (_field, body) => {
      const res = await POST(makeRequest("POST", body));

      expect(res.status).toBe(400);
      expect(insertPayment).not.toHaveBeenCalled();
    });

    it.each(["2026-13", "2026-8", "August"])(
      "returns 400 for a malformed month (%j)",
      async (month) => {
        const res = await POST(makeRequest("POST", { tenant_id: "t1", month }));

        expect(res.status).toBe(400);
        expect(getPayments).not.toHaveBeenCalled();
      }
    );

    it.each(["2026-02-30", "03-09-2026", "2026-09"])(
      "returns 400 for a malformed paid_on (%j) without touching the DB",
      async (paid_on) => {
        const res = await POST(makeRequest("POST", { tenant_id: "t1", month: "2026-08", paid_on }));
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toBe("Invalid payment date. Expected YYYY-MM-DD");
        expect(getPayments).not.toHaveBeenCalled();
        expect(insertPayment).not.toHaveBeenCalled();
      }
    );

    it("returns 400 for a paid_on in the future", async () => {
      const res = await POST(
        makeRequest("POST", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-20" })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("Payment date can't be in the future");
      expect(insertPayment).not.toHaveBeenCalled();
    });

    it("returns a controlled 500 JSON response for a malformed JSON body, instead of throwing", async () => {
      const res = await POST(malformedJsonRequest("POST"));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBeDefined();
    });

    it("returns a 500 with the message when the insert fails", async () => {
      vi.mocked(insertPayment).mockRejectedValue(new Error("Failed to insert payment: boom"));

      const res = await POST(makeRequest("POST", { tenant_id: "t1", month: "2026-08" }));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Failed to insert payment: boom");
    });
  });
});

describe("PATCH /api/mark-paid", () => {
  it("moves the recorded date of that tenant's rent month, and nothing else", async () => {
    vi.mocked(getPayments).mockResolvedValue([
      storedPayment({ id: 11, tenant_id: "t1", month: "2026-08", rent_month: "2026-07" }),
      storedPayment({ id: 12, tenant_id: "t1", month: "2026-09", paid_on: "2026-09-15", rent_month: "2026-08" }),
      storedPayment({ id: 13, tenant_id: "t2", month: "2026-09", paid_on: "2026-09-15", rent_month: "2026-08" }),
    ]);

    const res = await PATCH(
      makeRequest("PATCH", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-05" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(updatePaymentPaidOn).toHaveBeenCalledTimes(1);
    expect(updatePaymentPaidOn).toHaveBeenCalledWith(12, "2026-09-05");
    expect(insertPayment).not.toHaveBeenCalled();
  });

  it("also allows moving a date later, e.g. to fix a mistyped day", async () => {
    vi.mocked(getPayments).mockResolvedValue([
      storedPayment({ id: 12, tenant_id: "t1", month: "2026-09", paid_on: "2026-09-01", rent_month: "2026-08" }),
    ]);

    const res = await PATCH(
      makeRequest("PATCH", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-10" })
    );

    expect(res.status).toBe(200);
    expect(updatePaymentPaidOn).toHaveBeenCalledWith(12, "2026-09-10");
  });

  it("returns 404 when no payment is recorded for that tenant's rent month", async () => {
    vi.mocked(getPayments).mockResolvedValue([
      storedPayment({ id: 13, tenant_id: "t2", month: "2026-09", rent_month: "2026-08" }),
    ]);

    const res = await PATCH(
      makeRequest("PATCH", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-05" })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("No payment recorded for this month");
    expect(updatePaymentPaidOn).not.toHaveBeenCalled();
  });

  describe("validation and error handling", () => {
    it.each([
      ["tenant_id", { month: "2026-08", paid_on: "2026-09-05" }],
      ["month", { tenant_id: "t1", paid_on: "2026-09-05" }],
      ["paid_on", { tenant_id: "t1", month: "2026-08" }],
    ])("returns 400 when %s is missing", async (_field, body) => {
      const res = await PATCH(makeRequest("PATCH", body));

      expect(res.status).toBe(400);
      expect(getPayments).not.toHaveBeenCalled();
      expect(updatePaymentPaidOn).not.toHaveBeenCalled();
    });

    it("returns 400 for a malformed month", async () => {
      const res = await PATCH(
        makeRequest("PATCH", { tenant_id: "t1", month: "2026-13", paid_on: "2026-09-05" })
      );

      expect(res.status).toBe(400);
      expect(getPayments).not.toHaveBeenCalled();
    });

    it.each([
      ["2026-09-31", "Invalid payment date. Expected YYYY-MM-DD"],
      ["2026-09-20", "Payment date can't be in the future"],
    ])("returns 400 for paid_on %j without touching the DB", async (paid_on, error) => {
      const res = await PATCH(makeRequest("PATCH", { tenant_id: "t1", month: "2026-08", paid_on }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe(error);
      expect(getPayments).not.toHaveBeenCalled();
      expect(updatePaymentPaidOn).not.toHaveBeenCalled();
    });

    it("returns a controlled 500 JSON response for a malformed JSON body", async () => {
      const res = await PATCH(malformedJsonRequest("PATCH"));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBeDefined();
    });

    it("returns a 500 with the message when the update fails", async () => {
      vi.mocked(getPayments).mockResolvedValue([
        storedPayment({ id: 12, tenant_id: "t1", month: "2026-09", rent_month: "2026-08" }),
      ]);
      vi.mocked(updatePaymentPaidOn).mockRejectedValue(new Error("Failed to update payment: boom"));

      const res = await PATCH(
        makeRequest("PATCH", { tenant_id: "t1", month: "2026-08", paid_on: "2026-09-05" })
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Failed to update payment: boom");
    });
  });
});
