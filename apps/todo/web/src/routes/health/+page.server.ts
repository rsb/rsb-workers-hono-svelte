import { env } from "cloudflare:workers";
import { readHealth } from "#lib/server/health.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => readHealth(env.API);
