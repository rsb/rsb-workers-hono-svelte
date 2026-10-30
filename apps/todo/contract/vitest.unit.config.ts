import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
    // Until the first test (profile-notes P10).
    passWithNoTests: true,
  },
});
