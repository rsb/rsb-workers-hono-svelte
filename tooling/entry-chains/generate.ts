// Generates an api's entry chain index from its construct (L24).
//
//   node tooling/entry-chains/generate.ts <construct file> <index file>
//   node tooling/entry-chains/generate.ts <construct file> <index file> --check
//
// With --check it writes nothing: it fails when the committed index differs
// from what the code generates. Paths are relative to the repo root, which
// is where it runs.

import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { readChains } from "./chains.ts";
import { emitIndex } from "./emit.ts";
import { ChainError } from "./read.ts";
import { readRoutes } from "./routes.ts";

const SCRIPT = "tooling/entry-chains/generate.ts";

const USAGE = "usage: node tooling/entry-chains/generate.ts <construct file> <index file> [--check]";

const main = async (args: string[]) => {
  const check = args.includes("--check");
  const [constructPath, indexPath] = args.filter((arg) => arg !== "--check");
  if (constructPath === undefined || indexPath === undefined) {
    console.error(USAGE);
    return 2;
  }

  const source = relative(process.cwd(), constructPath);
  const routes = await readRoutes(constructPath);
  let text = "";
  try {
    const chains = readChains(source, routes);
    text = emitIndex(chains, source, SCRIPT);
  } catch (error) {
    if (error instanceof ChainError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  if (!check) {
    writeFileSync(indexPath, text);
    console.log(`wrote ${indexPath}`);
    return 0;
  }
  let committed = "";
  try {
    committed = readFileSync(indexPath, "utf8");
  } catch {
    committed = "";
  }
  if (committed !== text) {
    console.error(`${indexPath} differs from what ${source} generates; run ${SCRIPT}`);
    return 1;
  }
  return 0;
};

process.exitCode = await main(process.argv.slice(2));
