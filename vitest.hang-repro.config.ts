import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate config used only to run the hang-repro specs under test/hang-repro/
// in an isolated child process (see lib/rent.test.ts's deferred-bug tests).
// Kept out of the main vitest.config.ts's `include` so these known-hanging
// scenarios are never picked up by a normal `pnpm test` run.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["test/hang-repro/**/*.spec.ts"],
    env: {
      SUPABASE_URL: "https://test.supabase.local",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
});
