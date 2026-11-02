import { type D1Migration, applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// TEST_MIGRATIONS is a test-only binding, so it is not in the generated Env.
const testEnv = env as Cloudflare.Env & { TEST_MIGRATIONS: D1Migration[] };

await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
