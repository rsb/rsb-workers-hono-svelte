import { readHealth } from "#lib/server/health.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => readHealth(locals.api);
