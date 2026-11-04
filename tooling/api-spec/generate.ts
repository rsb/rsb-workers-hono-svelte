// Generates an api's contract files from its spec (L26).
//
//   node tooling/api-spec/generate.ts <spec> <contract src dir>
//   node tooling/api-spec/generate.ts <spec> <contract src dir> --check
//
// With --check it writes nothing: it fails when a committed file differs
// from what the spec generates. Paths are relative to the repo root.

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { emitEndpoints, emitKinds, emitMessages } from "./emit-contract.ts";
import { parse } from "./parse.ts";

const SCRIPT = "tooling/api-spec/generate.ts";

const main = (args: string[]) => {
  const check = args.includes("--check");
  const [specPath, contractDir] = args.filter((arg) => arg !== "--check");
  if (specPath === undefined || contractDir === undefined) {
    console.error("usage: node tooling/api-spec/generate.ts <spec> <contract src dir> [--check]");
    return 2;
  }

  const parsed = parse(readFileSync(specPath, "utf8"));
  if (!parsed.ok) {
    for (const problem of parsed.problems) {
      console.error(`${specPath}:${problem.line}: ${problem.message}`);
    }
    return 1;
  }

  const source = relative(process.cwd(), specPath);
  const files = [
    { name: "kinds.ts", text: emitKinds(parsed.spec, source, SCRIPT) },
    { name: "messages.ts", text: emitMessages(parsed.spec, source, SCRIPT) },
    { name: "endpoints.ts", text: emitEndpoints(parsed.spec, source, SCRIPT) },
  ];

  let stale = 0;
  for (const file of files) {
    const path = join(contractDir, file.name);
    if (!check) {
      writeFileSync(path, file.text);
      console.log(`wrote ${path}`);
      continue;
    }
    let committed = "";
    try {
      committed = readFileSync(path, "utf8");
    } catch {
      committed = "";
    }
    if (committed !== file.text) {
      console.error(`${path} differs from what ${source} generates; run ${SCRIPT}`);
      stale += 1;
    }
  }
  if (stale > 0) {
    return 1;
  }
  return 0;
};

process.exitCode = main(process.argv.slice(2));
