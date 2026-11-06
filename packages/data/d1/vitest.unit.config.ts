import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
    // The JSON report is what the pillars view reads (logbook/pillars.md).
    reporters: ["default", "json"],
    outputFile: { json: "test-results/unit.json" },
  },
});
