import { env } from "cloudflare:workers";
import { construct } from "./construct.ts";
import { serve } from "./http.ts";

// Once per isolate: build everything from the bindings, then wire it to HTTP.
// No I/O here: Workers forbid it at module scope, and the toolchain already
// checks the bindings (`wrangler types --check`).
const api = construct({ appDb: env.APP_DB });

export default serve(api);
