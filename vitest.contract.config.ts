import { defineConfig } from "vitest/config";

// Test-only Node runner for `npm run contract:check`. It is deliberately not
// part of `npm run check` because it needs staging credentials and the network.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/api/contract-check.spec.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
