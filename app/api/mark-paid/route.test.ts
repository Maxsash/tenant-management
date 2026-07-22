import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePayment } from "@/test/fixtures/payments";

vi.mock("@/lib/db", () => ({
  getPayments: vi.fn(),
  insertPayment: vi.fn(),
}));

import { getPayments, insertPayment } from "@/lib/db";
import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/mark-paid", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(getPayments).mockReset();
  vi.mocked(insertPayment).mockReset();
});

describe("POST /api/mark-paid", () => {
  it("converts the rent month to a payment month and inserts the payment", async () => {
    vi.mocked(getPayments).mockResolvedValue([]);
    vi.mocked(insertPayment).mockResolvedValue(undefined);

    const res = await POST(
      makeRequest({ tenant_id: "t1", month: "2026-06", paid_on: "2026-07-03" })
    );
    const body = await res.json();

    expect(insertPayment).toHaveBeenCalledWith({
      tenant_id: "t1",
      month: "2026-07",
      paid_on: "2026-07-03",
    });
    expect(body).toEqual({ ok: true });
  });

  it("rejects a duplicate payment for the same tenant/rent_month without inserting", async () => {
    vi.mocked(getPayments).mockResolvedValue([
      { ...makePayment({ tenant_id: "t1" }), rent_month: "2026-06" },
    ]);

    const res = await POST(
      makeRequest({ tenant_id: "t1", month: "2026-06", paid_on: "2026-07-03" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Already marked paid" });
    expect(insertPayment).not.toHaveBeenCalled();
  });

  describe("validation and error handling", () => {
    // Unlike this route, every sibling route (broadcast, monthly-greeting,
    // tenant-payments) validates required fields and has a try/catch —
    // this route now matches that pattern.
    it.each([
      ["tenant_id", { month: "2026-06", paid_on: "2026-07-03" }],
      ["month", { tenant_id: "t1", paid_on: "2026-07-03" }],
    ])("returns 400 when %s is missing", async (_field, body) => {
      vi.mocked(getPayments).mockResolvedValue([]);
      vi.mocked(insertPayment).mockResolvedValue(undefined);

      const res = await POST(makeRequest(body));

      expect(res.status).toBe(400);
    });

    it("returns a controlled 500 JSON response for a malformed JSON body, instead of throwing", async () => {
      const badRequest = new Request("http://localhost/api/mark-paid", {
        method: "POST",
        body: "not valid json{{{",
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(badRequest);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBeDefined();
    });

    it("stamps paid_on with the server's current date when the client omits it", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));
      vi.mocked(getPayments).mockResolvedValue([]);
      vi.mocked(insertPayment).mockResolvedValue(undefined);

      await POST(makeRequest({ tenant_id: "t1", month: "2026-06" }));

      expect(insertPayment).toHaveBeenCalledWith(
        expect.objectContaining({ paid_on: "2026-07-20" })
      );

      vi.useRealTimers();
    });
  });
});
