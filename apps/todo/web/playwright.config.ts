import { defineConfig, devices } from "@playwright/test";

// test:e2e starts the stack: the API Worker, then the BFF that binds to it.
export default defineConfig({
  testDir: "e2e",
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
