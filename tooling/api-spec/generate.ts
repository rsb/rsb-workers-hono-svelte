// Generates an api's contract files and its OpenAPI document from its spec
// (L26), with each route's entry point and unit read from its construct.
//
//   node tooling/api-spec/generate.ts <spec> <contract src dir> <openapi file> <construct file>
//   node tooling/api-spec/generate.ts <spec> <contract src dir> <openapi file> <construct file> --check
//
// With --check it writes nothing: it fails when a committed file differs
// from what the spec and the construct generate. Paths are relative to the
// repo root.
//
// The contract is written before the construct is read, since the construct
// imports it. With --check the construct reads the committed contract, the
// one this run compares.

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readRoutes } from "../entry-chains/routes.ts";
import { emitEndpoints, emitExamples, emitKinds, emitMessages } from "./emit-contract.ts";
import { emitOpenApi } from "./emit-openapi.ts";
import { parse } from "./parse.ts";

const SCRIPT = "tooling/api-spec/generate.ts";

const USAGE = "usage: node tooling/api-spec/generate.ts <spec> <contract src dir> <openapi file> <construct file> [--check]";

type File = { path: string; text: string };

/** Writes each file, or with `check` compares it to the committed one. Returns how many differ. */
const settle = (files: File[], check: boolean, source: string) => {
  let stale = 0;
  for (const file of files) {
    const path = file.path;
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
  return stale;
};

const main = async (args: string[]) => {
  const check = args.includes("--check");
  const [specPath, contractDir, openApiPath, constructPath] = args.filter((arg) => arg !== "--check");
  if (specPath === undefined || contractDir === undefined || openApiPath === undefined || constructPath === undefined) {
    console.error(USAGE);
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
  const contract = [
    { path: join(contractDir, "kinds.ts"), text: emitKinds(parsed.spec, source, SCRIPT) },
    { path: join(contractDir, "messages.ts"), text: emitMessages(parsed.spec, source, SCRIPT) },
    { path: join(contractDir, "endpoints.ts"), text: emitEndpoints(parsed.spec, source, SCRIPT) },
    { path: join(contractDir, "examples.ts"), text: emitExamples(parsed.spec, source, SCRIPT) },
  ];
  let stale = settle(contract, check, source);

  const routes = await readRoutes(constructPath);
  let openApi = "";
  try {
    openApi = emitOpenApi(parsed.spec, routes, source, SCRIPT);
  } catch (error) {
    console.error(`${constructPath}: ${(error as Error).message}`);
    return 1;
  }
  const both = `${source} and ${relative(process.cwd(), constructPath)}`;
  stale += settle([{ path: openApiPath, text: openApi }], check, both);

  if (stale > 0) {
    return 1;
  }
  return 0;
};

process.exitCode = await main(process.argv.slice(2));
