import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin-auth";
import { makeExpenseCategory, makeExpenseItem } from "@/test/fixtures/expenses";
import type { SlipExtraction } from "@/types/slip";

vi.mock("@/lib/db", () => ({
  getExpenseCategories: vi.fn(),
  getExpenseItems: vi.fn(),
}));

vi.mock("@/lib/slip-reader", async () => {
  const actual = await vi.importActual<typeof import("@/lib/slip-reader")>(
    "@/lib/slip-reader"
  );

  return {
    ...actual,
    readSlipImage: vi.fn(),
    isSlipReadingConfigured: vi.fn(),
    isSupportedImageType: vi.fn(),
    supportedImageTypes: vi.fn(() => ["image/jpeg", "image/png"]),
  };
});

import { getExpenseCategories, getExpenseItems } from "@/lib/db";
import {
  isSlipReadingConfigured,
  isSupportedImageType,
  readSlipImage,
} from "@/lib/slip-reader";
import { POST } from "./route";

const ORIGINAL_PIN = process.env.ADMIN_PIN;

function makeRequest({
  authed = true,
  level = "user" as "user" | "admin",
  type = "image/jpeg",
  bytes = 1024,
  field = "image",
  omitFile = false,
} = {}) {
  const form = new FormData();

  if (!omitFile) {
    form.set(field, new File([new Uint8Array(bytes)], "slip.jpg", { type }));
  }

  return new Request("http://localhost/api/slip-scan", {
    method: "POST",
    body: form,
    headers: authed
      ? { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionToken(level)}` }
      : undefined,
  });
}

function makeExtraction(overrides: Partial<SlipExtraction> = {}): SlipExtraction {
  return {
    slip_date: "2026-07-07",
    stated_total: 70,
    lines: [
      {
        raw_text: "आलू 3 kg 40",
        line_date: null,
        item_name: "Aalu",
        category: null,
        quantity: 500,
        unit: "g",
        amount: 40,
      },
      {
        raw_text: "चिरौंजी 30",
        line_date: null,
        item_name: "Chironji",
        category: "Groceries",
        quantity: null,
        unit: null,
        amount: 30,
      },
    ],
    unreadable: null,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.ADMIN_PIN = "1234";
  vi.mocked(getExpenseCategories).mockResolvedValue([
    makeExpenseCategory({ id: "cat-veg", name: "Vegetables & Fruits" }),
    makeExpenseCategory({ id: "cat-groc", name: "Groceries", sort_order: 1 }),
  ]);
  vi.mocked(getExpenseItems).mockResolvedValue([
    makeExpenseItem({
      id: "item-aaloo",
      name: "Aaloo",
      category: "Vegetables & Fruits",
      default_unit: "kg",
    }),
  ]);
  vi.mocked(isSlipReadingConfigured).mockReturnValue(true);
  vi.mocked(isSupportedImageType).mockImplementation((type: string) =>
    ["image/jpeg", "image/png", "image/webp", "image/heic"].includes(type)
  );
  vi.mocked(readSlipImage).mockResolvedValue(makeExtraction());
});

afterEach(() => {
  process.env.ADMIN_PIN = ORIGINAL_PIN;
  vi.clearAllMocks();
});

describe("POST /api/slip-scan", () => {
  it("turns a photo into a draft with the lines matched to the catalogue", async () => {
    const res = await POST(makeRequest());
    const { draft } = await res.json();

    expect(res.status).toBe(200);
    expect(draft.expense_date).toBe("2026-07-07");
    expect(draft.lines[0]).toMatchObject({
      item_id: "item-aaloo",
      item_name: "Aaloo",
      quantity: 0.5,
      unit: "kg",
    });
    expect(draft.lines[1]).toMatchObject({
      item_id: null,
      item_name: "Chironji",
      category: "Groceries",
    });
  });

  it("reports whether the slip's own total matches its lines", async () => {
    const { draft } = await (await POST(makeRequest())).json();

    expect(draft.linesTotal).toBe(70);
    expect(draft.statedTotal).toBe(70);
    expect(draft.totalsAgree).toBe(true);
  });

  it("writes nothing to the database", async () => {
    await POST(makeRequest());

    // The only db functions the route is even given are the two reads.
    expect(getExpenseCategories).toHaveBeenCalled();
    expect(getExpenseItems).toHaveBeenCalled();
  });

  it("hands the model the catalogue it should answer in", async () => {
    await POST(makeRequest());

    const call = vi.mocked(readSlipImage).mock.calls[0][0];

    expect(call.items).toHaveLength(1);
    expect(call.categories).toHaveLength(2);
    expect(call.mediaType).toBe("image/jpeg");
    expect(call.base64Image.length).toBeGreaterThan(0);
  });

  it("turns away a caller with no PIN session", async () => {
    const res = await POST(makeRequest({ authed: false }));

    expect(res.status).toBe(401);
    expect(readSlipImage).not.toHaveBeenCalled();
  });

  it("accepts an admin session too, since the tiers are hierarchical", async () => {
    const res = await POST(makeRequest({ level: "admin" }));

    expect(res.status).toBe(200);
  });

  it("names the keys that would switch slip reading on when none is set", async () => {
    vi.mocked(isSlipReadingConfigured).mockReturnValue(false);

    const res = await POST(makeRequest());
    const { error } = await res.json();

    expect(res.status).toBe(501);
    expect(error).toContain("GEMINI_API_KEY");
    expect(error).toContain("ANTHROPIC_API_KEY");
    expect(readSlipImage).not.toHaveBeenCalled();
  });

  it("accepts HEIC, which is what an iPhone shoots", async () => {
    const res = await POST(makeRequest({ type: "image/heic" }));

    expect(res.status).toBe(200);
  });

  it("rejects a request with no photo attached", async () => {
    const res = await POST(makeRequest({ omitFile: true }));

    expect(res.status).toBe(400);
    expect(readSlipImage).not.toHaveBeenCalled();
  });

  it("rejects a file that is not an image the reader accepts", async () => {
    const res = await POST(makeRequest({ type: "application/pdf" }));

    expect(res.status).toBe(415);
    expect(readSlipImage).not.toHaveBeenCalled();
  });

  it("rejects a photo past the size ceiling before spending an API call", async () => {
    const res = await POST(makeRequest({ bytes: 5 * 1024 * 1024 }));

    expect(res.status).toBe(413);
    expect(readSlipImage).not.toHaveBeenCalled();
  });

  it("surfaces a reader failure as a 502 with its message", async () => {
    vi.mocked(readSlipImage).mockRejectedValue(new Error("model declined"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("model declined");
  });

  it("keeps an undated slip usable by falling back to today", async () => {
    vi.mocked(readSlipImage).mockResolvedValue(
      makeExtraction({ slip_date: null })
    );

    const { draft } = await (await POST(makeRequest())).json();

    expect(draft.expense_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
