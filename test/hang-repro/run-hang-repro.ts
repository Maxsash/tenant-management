import { execFileSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const VITEST_ENTRY = path.join(REPO_ROOT, "node_modules", "vitest", "vitest.mjs");
const HANG_REPRO_CONFIG = path.join(REPO_ROOT, "vitest.hang-repro.config.ts");

/**
 * Runs a single hang-repro spec (see test/hang-repro/*.spec.ts) in its own
 * child process with a hard OS-level timeout, since some of these scenarios
 * are genuine synchronous infinite loops that Vitest's own per-test timeout
 * cannot interrupt (that mechanism needs the event loop to yield, which a
 * blocking `while` loop never does). If the child doesn't finish in time,
 * Node kills it and this returns `{ timedOut: true }` instead of hanging the
 * calling test process.
 */
export function runHangRepro(specFile: string, timeoutMs = 3000): { timedOut: boolean } {
  try {
    execFileSync(
      process.execPath,
      [VITEST_ENTRY, "run", "--config", HANG_REPRO_CONFIG, specFile],
      { cwd: REPO_ROOT, timeout: timeoutMs, stdio: "pipe" }
    );
    return { timedOut: false };
  } catch (err) {
    const nodeError = err as NodeJS.ErrnoException & { signal?: string };
    if (nodeError.signal || nodeError.code === "ETIMEDOUT") {
      return { timedOut: true };
    }
    // A real assertion failure inside the spec (not a hang) should still
    // surface as a normal test failure, not be silently swallowed.
    throw err;
  }
}
