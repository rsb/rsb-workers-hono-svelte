import { defineConfig, devices } from "@playwright/test";

// test:e2e starts the stack: the API Worker, then the BFF that binds to it.
// One worker: every file shares the API's store, so files run one at a time,
// in file order, and slice 2's "given no todos" runs first (D19).
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: { baseURL: "http://localhost:5173" },
  webServer: [
    {
      command: "pnpm --filter @todo/api dev",
      url: "http://localhost:8787/health",
      reuseExistingServer: false,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5173/health",
      reuseExistingServer: false,
    },
  ],
});
