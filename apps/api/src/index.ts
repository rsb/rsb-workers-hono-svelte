import { env } from "cloudflare:workers";
import { readConfig } from "./config.ts";
import { construct } from "./construct.ts";
import { serve } from "./http.ts";

// Once per isolate: load config, build everything, then wire it to HTTP.
const config = readConfig(env);

// A broken config is a deploy error, not a request error: the Worker refuses
// to start, and says which value is wrong (DB5).
if (!config.ok) throw new Error(`config: ${config.error}`);

const api = construct(config.value);

export default serve(api);
