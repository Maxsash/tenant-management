import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeExpenseCategory, makeExpenseItem } from "@/test/fixtures/expenses";

const generateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { GEMINI_MODELS, GEMINI_TIMING, geminiReader, isTransientGeminiError } from "./gemini";
import type { ReadSlipOptions } from "./types";

const busy = Object.assign(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'), {
  status: 503,
});

const answer = {
  slip_date: null,
  stated_total: 40,
  lines: [
    {
      raw_text: "Aaloo 2 kg 40",
      line_date: "2026-09-07",
      item_name: "Aaloo",
      category: null,
      quantity: 2,
      unit: "kg",
      amount: 40,
    },
  ],
  unreadable: null,
};

const options: ReadSlipOptions = {
  images: [
    { base64: "ZnJvbnQ=", mediaType: "image/jpeg" },
    { base64: "YmFjaw==", mediaType: "image/jpeg" },
  ],
  categories: [makeExpenseCategory({ name: "Vegetables & Fruits" })],
  items: [makeExpenseItem({ name: "Aaloo", category: "Vegetables & Fruits" })],
  today: "2026-09-16",
};

type Request = {
  model: string;
  contents: Array<{ inlineData?: { data: string }; text?: string }>;
  config: { abortSignal?: AbortSignal };
};

/** Makes a model answer after `ms`, or hang until it is told to stop. */
function respond(model: string, ms: number, outcome: "answer" | "busy" | "hang") {
  return (request: Request) => {
    if (request.model !== model) return undefined;

    return new Promise((resolve, reject) => {
      if (outcome === "hang") {
        request.config.abortSignal?.addEventListener("abort", () =>
          reject(new Error("aborted"))
        );
        return;
      }

      setTimeout(() => {
        if (outcome === "answer") resolve({ text: JSON.stringify(answer) });
        else reject(busy);
      }, ms);
    });
  };
}

function scenario(...handlers: Array<(request: Request) => Promise<unknown> | undefined>) {
  generateContent.mockImplementation((request: Request) => {
    for (const handler of handlers) {
      const result = handler(request);
      if (result) return result;
    }

    return new Promise(() => {});
  });
}

const originalKey = process.env.GEMINI_API_KEY;

beforeEach(() => {
  vi.useFakeTimers();
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  vi.useRealTimers();
  generateContent.mockReset();
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

describe("geminiReader", () => {
  it("sends every photo, in order, ahead of a request naming how many there are", async () => {
    scenario(respond(GEMINI_MODELS[0], 1_000, "answer"));

    const read = geminiReader.read(options);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(read).resolves.toMatchObject({ stated_total: 40 });

    const request = generateContent.mock.calls[0][0] as Request;

    expect(request.contents.map((part) => part.inlineData?.data)).toEqual([
      "ZnJvbnQ=",
      "YmFjaw==",
      undefined,
    ]);
    expect(request.contents[2].text).toContain("These 2 photos are one slip");
  });

  it("does not wait out a model that hangs before saying it is busy", async () => {
    // What broke scanning: the first model took over 100 seconds to return a
    // 503, and the phone had given up long before the list moved on.
    scenario(
      respond(GEMINI_MODELS[0], 0, "hang"),
      respond(GEMINI_MODELS[1], 8_000, "answer")
    );

    const read = geminiReader.read(options);
    await vi.advanceTimersByTimeAsync(GEMINI_TIMING.staggerMs + 8_000);

    await expect(read).resolves.toMatchObject({ stated_total: 40 });
    expect(GEMINI_TIMING.staggerMs + 8_000).toBeLessThan(GEMINI_TIMING.deadlineMs);
  });

  it("tries the next model as soon as one says it is busy", async () => {
    scenario(
      respond(GEMINI_MODELS[0], 2_000, "busy"),
      respond(GEMINI_MODELS[1], 2_000, "answer")
    );

    const read = geminiReader.read(options);
    await vi.advanceTimersByTimeAsync(4_000);

    await expect(read).resolves.toMatchObject({ stated_total: 40 });
  });

  it("answers within the deadline, in plain words, when every model is stuck", async () => {
    scenario(...GEMINI_MODELS.map((model) => respond(model, 0, "hang")));

    const read = geminiReader.read(options);
    const settled = expect(read).rejects.toThrow("took too long");

    await vi.advanceTimersByTimeAsync(GEMINI_TIMING.deadlineMs);

    await settled;
  });

  it("says Google is busy when every model has said so", async () => {
    scenario(...GEMINI_MODELS.map((model) => respond(model, 1_000, "busy")));

    const read = geminiReader.read(options);
    const settled = expect(read).rejects.toThrow("too busy");

    await vi.advanceTimersByTimeAsync(GEMINI_MODELS.length * 1_000);

    await settled;
  });

  it("stops at a bad key instead of spending a call on every model", async () => {
    generateContent.mockRejectedValue(
      Object.assign(new Error("API key not valid"), { status: 400 })
    );

    await expect(geminiReader.read(options)).rejects.toThrow("API key not valid");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("GEMINI_TIMING", () => {
  it("keeps the whole read well under a minute, so the phone is still waiting", () => {
    expect(GEMINI_TIMING.deadlineMs).toBeLessThanOrEqual(50_000);
  });

  it("gives every model a chance to start before the deadline", () => {
    expect(GEMINI_TIMING.staggerMs * (GEMINI_MODELS.length - 1)).toBeLessThan(
      GEMINI_TIMING.deadlineMs
    );
  });
});

describe("isTransientGeminiError", () => {
  it("moves on for capacity, rate limits and server faults", () => {
    expect(isTransientGeminiError(busy)).toBe(true);
    expect(isTransientGeminiError({ status: 429 })).toBe(true);
    expect(isTransientGeminiError(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
  });

  it("does not for a request that would fail the same way everywhere", () => {
    expect(isTransientGeminiError({ status: 400 })).toBe(false);
    expect(isTransientGeminiError(new Error("API key not valid"))).toBe(false);
  });
});
