import { env } from "cloudflare:workers";
import { configOf } from "./config.ts";
import { construct } from "./construct.ts";
import { serve } from "./http.ts";

// Once per isolate: build everything from the bindings and the config, then
// wire it to HTTP.
// No I/O here: Workers forbid it at module scope, and the toolchain already
// checks the bindings (`wrangler types --check`).
const api = construct({ appDb: env.APP_DB, identityDb: env.IDENTITY_DB }, configOf(env));

export default serve(api);
