import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ANTHROPIC_IMAGE_TYPES,
  GEMINI_IMAGE_TYPES,
  getSlipReader,
  isSlipReadingConfigured,
  isSupportedImageType,
  MAX_IMAGE_BYTES,
  missingKeyMessage,
  supportedImageTypes,
} from "./index";

const ORIGINAL = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
};

function setKeys({ anthropic, gemini }: { anthropic?: string; gemini?: string }) {
  if (anthropic) process.env.ANTHROPIC_API_KEY = anthropic;
  else delete process.env.ANTHROPIC_API_KEY;

  if (gemini) process.env.GEMINI_API_KEY = gemini;
  else delete process.env.GEMINI_API_KEY;
}

beforeEach(() => setKeys({}));

afterEach(() => {
  if (ORIGINAL.anthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL.anthropic;

  if (ORIGINAL.gemini === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = ORIGINAL.gemini;
});

describe("getSlipReader", () => {
  it("reports nothing configured when neither key is set", () => {
    expect(getSlipReader()).toBeNull();
    expect(isSlipReadingConfigured()).toBe(false);
  });

  it("uses Gemini when it is the only key set — the free path", () => {
    setKeys({ gemini: "g" });

    expect(getSlipReader()?.name).toBe("gemini");
    expect(isSlipReadingConfigured()).toBe(true);
  });

  it("uses Anthropic when it is the only key set", () => {
    setKeys({ anthropic: "a" });

    expect(getSlipReader()?.name).toBe("anthropic");
  });

  it("prefers Anthropic when both are set, since it reads this handwriting better", () => {
    setKeys({ anthropic: "a", gemini: "g" });

    expect(getSlipReader()?.name).toBe("anthropic");
  });
});

describe("supportedImageTypes", () => {
  it("accepts HEIC under Gemini, which is what an iPhone shoots", () => {
    setKeys({ gemini: "g" });

    expect(isSupportedImageType("image/heic")).toBe(true);
    expect(supportedImageTypes()).toEqual(GEMINI_IMAGE_TYPES);
  });

  it("does not claim HEIC under Anthropic, which cannot decode it", () => {
    setKeys({ anthropic: "a" });

    expect(isSupportedImageType("image/heic")).toBe(false);
    expect(isSupportedImageType("image/jpeg")).toBe(true);
    expect(supportedImageTypes()).toEqual(ANTHROPIC_IMAGE_TYPES);
  });

  it("accepts nothing when no reader is configured", () => {
    expect(supportedImageTypes()).toEqual([]);
    expect(isSupportedImageType("image/jpeg")).toBe(false);
  });

  it("agrees with both providers on plain JPEG, which the phone always sends", () => {
    // lib/slip-image.ts re-encodes every photo to JPEG before upload, so this
    // is the one type that must never stop working.
    expect(GEMINI_IMAGE_TYPES).toContain("image/jpeg");
    expect(ANTHROPIC_IMAGE_TYPES).toContain("image/jpeg");
  });
});

describe("missingKeyMessage", () => {
  it("names every variable that would switch slip reading on", () => {
    const message = missingKeyMessage();

    expect(message).toContain("ANTHROPIC_API_KEY");
    expect(message).toContain("GEMINI_API_KEY");
  });
});

describe("MAX_IMAGE_BYTES", () => {
  it("stays under the smaller of the two providers' inline limits", () => {
    expect(MAX_IMAGE_BYTES).toBeLessThanOrEqual(5 * 1024 * 1024);
  });
});
