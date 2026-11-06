import { type D1Migration, applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// The migrations are test-only bindings, so they are not in the generated Env.
const testEnv = env as Cloudflare.Env & {
  TEST_APP_MIGRATIONS: D1Migration[];
  TEST_IDENTITY_MIGRATIONS: D1Migration[];
};

await applyD1Migrations(testEnv.APP_DB, testEnv.TEST_APP_MIGRATIONS);
await applyD1Migrations(testEnv.IDENTITY_DB, testEnv.TEST_IDENTITY_MIGRATIONS);
