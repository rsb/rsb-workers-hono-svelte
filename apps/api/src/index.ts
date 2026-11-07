import { env } from "cloudflare:workers";
// Argon2's .wasm, which wrangler uploads as a module and the platform
// compiles: no fetch, no eval (L48). Named as `default`, the one form of
// import the entry-chains reader takes.
import { default as argon2Wasm } from "@phi-ag/argon2/argon2.wasm";
import { readConfig } from "./config.ts";
import { construct } from "./construct.ts";
import { serve } from "./http.ts";
import { misconfigured } from "./misconfigured.ts";

// Once per isolate: read the config, build everything from the bindings and
// it, then wire it to HTTP. A config that does not read builds nothing: the
// api answers every request in the envelope, and logs why.
// No I/O here: Workers forbid it at module scope, and the toolchain already
// checks the bindings (`wrangler types --check`).
const config = readConfig(env);

export default config.ok
  ? serve(construct({ appDb: env.APP_DB, identityDb: env.IDENTITY_DB, argon2Wasm }, config.value))
  : misconfigured(config.error);
