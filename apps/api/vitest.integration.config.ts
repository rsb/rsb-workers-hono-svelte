import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  // Read under Node, then handed to the Worker, which applies them (DB8):
  // each database its own (L42).
  const appMigrations = await readD1Migrations("../../packages/data/d1/migrations/app");
  const identityMigrations = await readD1Migrations("../../packages/data/d1/migrations/identity");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_APP_MIGRATIONS: appMigrations, TEST_IDENTITY_MIGRATIONS: identityMigrations } },
      }),
    ],
    test: {
      include: ["test/integration/**/*.test.ts"],
      // Storage is isolated per test file, so each file starts on an empty,
      // migrated database (DB9), holding a member's and an admin's session.
      setupFiles: ["./test/integration/apply-migrations.ts", "./test/integration/seed-sessions.ts"],
    },
  };
});
