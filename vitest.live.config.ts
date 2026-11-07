import { defineConfig } from "vitest/config";

// Live tests call the real Edgaze API. They need EDGAZE_API_KEY and skip themselves without it.
export default defineConfig({
  test: {
    include: ["tests/live/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
