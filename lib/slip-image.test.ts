import { describe, expect, it } from "vitest";
import { fitWithin, MAX_PHOTO_EDGE, PHOTO_QUALITY } from "@/lib/slip-image";

describe("fitWithin", () => {
  it("shrinks a phone photo to the long edge, keeping its shape", () => {
    // Roughly what a modern iPhone main camera produces.
    const fitted = fitWithin({ width: 4032, height: 3024 }, 2000);

    expect(fitted.width).toBe(2000);
    expect(fitted.height).toBe(1500);
  });

  it("works the same way for a portrait photo", () => {
    const fitted = fitWithin({ width: 3024, height: 4032 }, 2000);

    expect(fitted.height).toBe(2000);
    expect(fitted.width).toBe(1500);
  });

  it("leaves an already-small image alone rather than upscaling it", () => {
    expect(fitWithin({ width: 800, height: 600 }, 2000)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("keeps a very thin image at least one pixel wide", () => {
    const fitted = fitWithin({ width: 6000, height: 2 }, 2000);

    expect(fitted.width).toBe(2000);
    expect(fitted.height).toBeGreaterThanOrEqual(1);
  });

  it("does not divide by zero on a degenerate image", () => {
    expect(fitWithin({ width: 0, height: 0 }, 2000)).toEqual({ width: 0, height: 0 });
  });

  it("defaults to the exported long edge", () => {
    expect(fitWithin({ width: 9000, height: 9000 })).toEqual({
      width: MAX_PHOTO_EDGE,
      height: MAX_PHOTO_EDGE,
    });
  });
});

describe("photo settings", () => {
  it("keeps quality high enough for thin pen strokes", () => {
    expect(PHOTO_QUALITY).toBeGreaterThanOrEqual(0.8);
  });
});
