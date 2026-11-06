import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
    // The JSON report is what `pnpm check:join` reads to see that each state
    // rule a use case is given has a test, named by its id, that passed (L33),
    // and what the pillars view reads (logbook/pillars.md).
    reporters: ["default", "json"],
    outputFile: { json: "test-results/unit.json" },
  },
});
