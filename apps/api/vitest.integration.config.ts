import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  // Read under Node, then handed to the Worker, which applies them (DB8).
  const migrations = await readD1Migrations("../../packages/data/d1/migrations");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ["test/integration/**/*.test.ts"],
      // Storage is isolated per test file, so each file starts on an empty,
      // migrated database (DB9).
      setupFiles: ["./test/integration/apply-migrations.ts"],
    },
  };
});
