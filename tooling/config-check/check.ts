// Checks the variables local dev runs on against the api's own config
// schema, `readConfig` in apps/api/src/config.ts, before anything runs on
// them (backlog E). It writes nothing.
//
//   node tooling/config-check/check.ts <wrangler.jsonc> <.dev.vars>
//
// It checks what runs: the committed `vars` with the `.dev.vars` laid over
// them, as `wrangler dev` reads them, or the committed vars alone when there
// is no `.dev.vars`. The committed vars alone are not a deployed config:
// their BFF_ORIGIN is local dev's. Checking a deploy's vars arrives with the
// deploy workflow, which brings its own. It names each variable and its
// problem, and exits 1 when the set does not read.

import { existsSync, readFileSync } from "node:fs";
import { describeProblems, readConfig } from "../../apps/api/src/config.ts";
import { devVars, wranglerVars } from "./read-vars.ts";

const USAGE = "usage: node tooling/config-check/check.ts <wrangler.jsonc> <.dev.vars>";

const main = (args: string[]) => {
  const [wranglerPath, devVarsPath, ...rest] = args;
  if (wranglerPath === undefined || devVarsPath === undefined || rest.length > 0) {
    console.error(USAGE);
    return 2;
  }

  const committed = wranglerVars(readFileSync(wranglerPath, "utf8"));
  const overlaid = existsSync(devVarsPath);
  const vars = overlaid ? { ...committed, ...devVars(readFileSync(devVarsPath, "utf8")) } : committed;
  const label = overlaid
    ? `the vars in ${wranglerPath}, with ${devVarsPath} over them,`
    : `the vars in ${wranglerPath} (there is no ${devVarsPath}),`;

  const read = readConfig(vars);
  if (read.ok) {
    console.log(`${label} read as the api's config`);
    return 0;
  }
  console.error(`${label} do not read as the api's config:\n${describeProblems(read.error).replace(/^/gm, "  ")}`);
  return 1;
};

process.exitCode = main(process.argv.slice(2));
