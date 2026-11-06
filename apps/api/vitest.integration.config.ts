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
        miniflare: {
          bindings: {
            TEST_APP_MIGRATIONS: appMigrations,
            TEST_IDENTITY_MIGRATIONS: identityMigrations,
            // Local dev's config: wrangler.jsonc's vars with the cookie the
            // dev seed writes to .dev.vars over them. .dev.vars is gitignored,
            // so CI has none, and the committed vars alone do not read: a
            // __Host- cookie under an http BFF (src/config.ts).
            SESSION_COOKIE: "sid",
            // The tests' own pepper, so the api's config reads without
            // .dev.vars (P68). Not a secret: it keys only the hashes these
            // tests make, in databases that last one test file.
            PEPPER_1: "integration-test-pepper-not-a-secret-0001",
          },
        },
      }),
    ],
    test: {
      include: ["test/integration/**/*.test.ts"],
      // The JSON report is what the pillars view reads (logbook/pillars.md).
      reporters: ["default", "json"],
      outputFile: { json: "test-results/integration.json" },
      // Storage is isolated per test file, so each file starts on an empty,
      // migrated database (DB9), holding a member's and an admin's session.
      setupFiles: ["./test/integration/apply-migrations.ts", "./test/integration/seed-sessions.ts"],
    },
  };
});
