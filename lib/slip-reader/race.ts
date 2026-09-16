/**
 * Asking several models the same question, staggered, and keeping the first
 * answer.
 *
 * Built for the free Gemini tier, where a model under load does not fail fast:
 * on 16 September 2026 `gemini-3.8-flash` took 100 and 149 seconds to answer
 * with a 503, while `gemini-3.6-flash` read the same page in 9. Trying models
 * one after another meant waiting out that whole hang before moving on, by
 * which point the phone had long since given up on the request and Safari was
 * showing "Load failed".
 *
 * So each attempt gets a head start rather than exclusive use of the clock.
 * If it has not answered by the time the stagger runs out, the next one starts
 * alongside it and whichever answers first wins. A failure worth retrying
 * starts the next attempt at once instead of waiting for the stagger, and
 * there is a hard deadline over the lot, kept short enough that the phone is
 * still listening when the answer arrives.
 */

export interface StaggeredRaceOptions {
  /** Head start one attempt gets before the next joins it. */
  staggerMs: number;
  /** When to stop waiting for any of them. */
  deadlineMs: number;
  /**
   * Whether a failure should hand over to the next attempt. Anything else is
   * reported straight away, since a bad key or a malformed request would fail
   * the same way on every attempt.
   */
  isRetryable: (error: unknown) => boolean;
}

/** One attempt. It should stop work when the signal aborts, since it has lost. */
export type RaceAttempt<T> = (signal: AbortSignal) => Promise<T>;

export class RaceExhaustedError extends Error {
  constructor(
    /** `deadline` when time ran out, `failed` when every attempt failed first. */
    readonly reason: "deadline" | "failed",
    options?: { cause?: unknown }
  ) {
    super(
      reason === "deadline" ? "No attempt answered in time" : "Every attempt failed",
      options
    );
    this.name = "RaceExhaustedError";
  }
}

export function staggeredRace<T>(
  attempts: RaceAttempt<T>[],
  { staggerMs, deadlineMs, isRetryable }: StaggeredRaceOptions
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (attempts.length === 0) {
      reject(new RaceExhaustedError("failed"));
      return;
    }

    const controllers: AbortController[] = [];
    let running = 0;
    let settled = false;
    let lastError: unknown;
    let staggerTimer: ReturnType<typeof setTimeout> | undefined;

    const deadlineTimer = setTimeout(
      () => finish(() => reject(new RaceExhaustedError("deadline", { cause: lastError }))),
      deadlineMs
    );

    function finish(settle: () => void) {
      if (settled) return;

      settled = true;
      clearTimeout(deadlineTimer);
      clearTimeout(staggerTimer);
      // The losers are still talking to the provider; tell them to stop.
      for (const controller of controllers) controller.abort();
      settle();
    }

    function startNext() {
      if (settled || controllers.length >= attempts.length) return;

      const controller = new AbortController();
      const attempt = attempts[controllers.length];

      controllers.push(controller);
      running++;

      clearTimeout(staggerTimer);
      if (controllers.length < attempts.length) {
        staggerTimer = setTimeout(startNext, staggerMs);
      }

      // Through a resolved promise, so an attempt that throws synchronously
      // is handled like one that rejects.
      Promise.resolve()
        .then(() => attempt(controller.signal))
        .then(
          (value) => finish(() => resolve(value)),
          (error) => {
            running--;
            if (settled) return;

            if (!isRetryable(error)) {
              finish(() => reject(error));
              return;
            }

            lastError = error;

            if (controllers.length < attempts.length) {
              startNext();
            } else if (running === 0) {
              finish(() => reject(new RaceExhaustedError("failed", { cause: error })));
            }
          }
        );
    }

    startNext();
  });
}
