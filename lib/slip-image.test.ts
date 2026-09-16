import { describe, expect, it } from "vitest";
import {
  ENCODE_STEPS,
  fitWithin,
  MAX_PHOTO_EDGE,
  MAX_SLIP_PHOTOS,
} from "@/lib/slip-image";

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
  it("tries the photo at full quality first, so thin pen strokes survive", () => {
    expect(ENCODE_STEPS[0]).toEqual({ maxEdge: MAX_PHOTO_EDGE, quality: 0.85 });
  });

  it("only ever gets smaller from one step to the next", () => {
    for (let i = 1; i < ENCODE_STEPS.length; i++) {
      const previous = ENCODE_STEPS[i - 1];
      const step = ENCODE_STEPS[i];

      expect(step.maxEdge).toBeLessThanOrEqual(previous.maxEdge);
      expect(step.quality).toBeLessThanOrEqual(previous.quality);
      expect(step.maxEdge < previous.maxEdge || step.quality < previous.quality).toBe(true);
    }
  });

  it("never shrinks a slip past what handwriting can be read from", () => {
    const last = ENCODE_STEPS[ENCODE_STEPS.length - 1];

    expect(last.maxEdge).toBeGreaterThanOrEqual(1600);
    expect(last.quality).toBeGreaterThanOrEqual(0.7);
  });

  it("allows at least both sides of a page", () => {
    expect(MAX_SLIP_PHOTOS).toBeGreaterThanOrEqual(2);
  });
});
