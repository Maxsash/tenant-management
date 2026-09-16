import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaceExhaustedError, staggeredRace, type RaceAttempt } from "./race";

const busy = Object.assign(new Error("503 UNAVAILABLE"), { status: 503 });
const badKey = Object.assign(new Error("400 API key not valid"), { status: 400 });

const options = {
  staggerMs: 10_000,
  deadlineMs: 45_000,
  isRetryable: (error: unknown) => (error as { status?: number }).status === 503,
};

/**
 * An attempt that settles after `ms`, recording whether it was started and
 * whether it was told to stop — the two things a race owes its losers.
 */
function attempt(ms: number, outcome: { value: string } | { error: Error }) {
  const record = { started: false, aborted: false };

  const run: RaceAttempt<string> = (signal) => {
    record.started = true;
    signal.addEventListener("abort", () => {
      record.aborted = true;
    });

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if ("value" in outcome) resolve(outcome.value);
        else reject(outcome.error);
      }, ms);
    });
  };

  return { run, record };
}

/** An attempt that never answers — the 100-second 503 this was built for. */
function hang() {
  return attempt(10 * 60_000, { error: busy });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("staggeredRace", () => {
  it("returns the first attempt's answer without starting another when it is quick", async () => {
    const first = attempt(3_000, { value: "first" });
    const second = attempt(1_000, { value: "second" });

    const race = staggeredRace([first.run, second.run], options);
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(race).resolves.toBe("first");
    expect(second.record.started).toBe(false);
  });

  it("starts the next attempt alongside a slow one, and keeps whichever answers first", async () => {
    const slow = hang();
    const next = attempt(5_000, { value: "next" });

    const race = staggeredRace([slow.run, next.run], options);
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(race).resolves.toBe("next");
    // The one still hanging is told to stop rather than left talking to Google.
    expect(slow.record.aborted).toBe(true);
  });

  it("moves on at once after a busy answer rather than waiting out the stagger", async () => {
    const busyFirst = attempt(2_000, { error: busy });
    const next = attempt(4_000, { value: "next" });

    const race = staggeredRace([busyFirst.run, next.run], options);
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(race).resolves.toBe("next");
  });

  it("gives up on everything at the deadline", async () => {
    const attempts = [hang(), hang(), hang()];

    const race = staggeredRace(
      attempts.map((a) => a.run),
      options
    );
    const settled = expect(race).rejects.toMatchObject({ reason: "deadline" });

    await vi.advanceTimersByTimeAsync(options.deadlineMs);

    await settled;
    expect(attempts.every((a) => a.record.started && a.record.aborted)).toBe(true);
  });

  it("reports running out of attempts, with the last failure as the cause", async () => {
    const race = staggeredRace(
      [attempt(1_000, { error: busy }).run, attempt(1_000, { error: busy }).run],
      options
    );
    const settled = expect(race).rejects.toBeInstanceOf(RaceExhaustedError);

    await vi.advanceTimersByTimeAsync(2_000);

    await settled;
    await race.catch((error: RaceExhaustedError) => {
      expect(error.reason).toBe("failed");
      expect(error.cause).toBe(busy);
    });
  });

  it("stops at a failure that would repeat on every attempt, like a bad key", async () => {
    const broken = attempt(1_000, { error: badKey });
    const next = attempt(1_000, { value: "next" });

    const race = staggeredRace([broken.run, next.run], options);
    const settled = expect(race).rejects.toBe(badKey);

    await vi.advanceTimersByTimeAsync(1_000);

    await settled;
    expect(next.record.started).toBe(false);
  });

  it("ignores a loser that fails after the race is already won", async () => {
    const slowFailure = attempt(20_000, { error: badKey });
    const winner = attempt(1_000, { value: "winner" });

    const race = staggeredRace([slowFailure.run, winner.run], options);
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(race).resolves.toBe("winner");
  });

  it("treats an attempt that throws before returning a promise like one that rejects", async () => {
    const throwsAtOnce: RaceAttempt<string> = () => {
      throw busy;
    };
    const next = attempt(1_000, { value: "next" });

    const race = staggeredRace([throwsAtOnce, next.run], options);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(race).resolves.toBe("next");
  });

  it("rejects straight away when there is nothing to try", async () => {
    await expect(staggeredRace([], options)).rejects.toBeInstanceOf(RaceExhaustedError);
  });
});
