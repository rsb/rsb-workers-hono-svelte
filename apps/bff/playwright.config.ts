import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The BFF finds the API through wrangler's dev registry, a file per Worker
// naming its address. A killed run leaves its file behind, and miniflare
// trusts it until it is WORKER_STALE_MS (90 s) old: until then the new API
// does not register, and the BFF dials the dead one's port. Each run gets a
// registry of its own, so no earlier run's file is read. `??=`: Playwright's
// workers load this config again and inherit the run's registry through the
// environment instead of making their own. `pnpm dev` keeps the shared one.
process.env.CLOUDFLARE_DEV_REGISTRY_PATH ??= mkdtempSync(join(tmpdir(), "todo-e2e-registry-"));
const registry = { CLOUDFLARE_DEV_REGISTRY_PATH: process.env.CLOUDFLARE_DEV_REGISTRY_PATH };

// test:e2e starts the stack: the API Worker, then the BFF that binds to it.
// The API runs on its own local database, deleted and migrated each run, so
// e2e starts with no todos and never touches the one `pnpm dev` uses (DB9).
// One worker: every file shares that database, so files run one at a time,
// in file order, and slice 2's "given no todos" runs first (D19).
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  // `e2e/last/` runs after every other file: sign out everywhere ends the
  // seeded sessions the other files sign in with.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: "last/**" },
    { name: "chromium-last", use: { ...devices["Desktop Chrome"] }, testMatch: "last/**/*.test.ts", dependencies: ["chromium"] },
  ],
  use: { baseURL: "http://localhost:5173" },
  // The JSON report is what the pillars view reads (logbook/pillars.md). It
  // sits beside the unit report, so Playwright's own output, which it empties
  // each run, goes one level down and leaves test-results/unit.json alone.
  reporter: [[process.env.CI ? "dot" : "list"], ["json", { outputFile: "test-results/e2e.json" }]],
  outputDir: "test-results/e2e",
  webServer: [
    {
      command: "pnpm --filter @todo/api dev:e2e",
      url: "http://localhost:8787/health",
      reuseExistingServer: false,
      env: registry,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5173/health",
      reuseExistingServer: false,
      env: registry,
    },
  ],
});
