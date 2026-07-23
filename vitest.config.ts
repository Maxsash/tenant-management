import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["lib/**/*.test.ts", "app/api/**/*.test.ts"],
    env: {
      SUPABASE_URL: "https://test.supabase.local",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**", "app/api/**"],
      exclude: ["**/*.test.ts", "app/**/page.tsx", "components/**"],
      reportOnFailure: true,
    },
  },
});
