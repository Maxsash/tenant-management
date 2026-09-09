import { describe, expect, it } from "vitest";
import { newId } from "@/lib/ids";

describe("newId", () => {
  it("gives every call a distinct id", () => {
    const ids = Array.from({ length: 200 }, () => newId());

    expect(new Set(ids).size).toBe(200);
  });

  it("still works where randomUUID is missing, as on plain http over the LAN", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");

    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });

    try {
      const ids = Array.from({ length: 50 }, () => newId());

      expect(new Set(ids).size).toBe(50);
      expect(ids.every((id) => id.length > 0)).toBe(true);
    } finally {
      if (original) Object.defineProperty(globalThis.crypto, "randomUUID", original);
    }
  });
});
