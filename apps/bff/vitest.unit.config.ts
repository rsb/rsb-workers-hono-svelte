import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // No Workers pool and no bindings in the unit tier (profile-notes P9).
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
  },
});
