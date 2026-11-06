// Generates business's access table from an access spec (L43), and checks
// the spec against the operations construct builds.
//
//   node tooling/access/generate.ts <spec> <construct> <business dir>
//   node tooling/access/generate.ts <spec> <construct> <business dir> --check
//
// Both fail when the spec breaks its table's vocabulary, when a row's use
// case is not a file beside the spec, when an operation construct builds
// has no row, or when a row names an operation construct does not build.
// With --check it writes nothing: it also fails when the committed table
// differs from what the spec generates. This is the static half; the api's
// unit tests call each built operation as each actor (the dynamic half).
// Paths are relative to the repo root.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { emit, parse } from "./parse.ts";

const SCRIPT = "tooling/access/generate.ts";

const USAGE = "usage: node tooling/access/generate.ts <spec> <construct> <business dir> [--check]";

type Construct = { constructOperations: (infra: Record<string, unknown>) => Record<string, unknown> };

/** Infra whose every part fails when used: building the operations uses none. */
const unused = new Proxy(
  {},
  {
    get: (_, part) =>
      new Proxy(() => {}, {
        apply: () => {
          throw new Error(`access: infra's ${String(part)} was called while building the operations`);
        },
        get: (__, method) => () => {
          throw new Error(`access: infra's ${String(part)}.${String(method)} was called while building the operations`);
        },
      }),
  },
);

/** The names of the operations the construct at `path` builds. */
const builtOperations = async (path: string): Promise<string[]> => {
  const construct = (await import(pathToFileURL(resolve(path)).href)) as Construct;
  return Object.keys(construct.constructOperations(unused as Record<string, unknown>));
};

const main = async (args: string[]) => {
  const check = args.includes("--check");
  const [specPath, constructPath, businessDir] = args.filter((arg) => arg !== "--check");
  if (specPath === undefined || constructPath === undefined || businessDir === undefined) {
    console.error(USAGE);
    return 2;
  }

  const source = relative(process.cwd(), specPath);
  const parsed = parse(readFileSync(specPath, "utf8"));
  if (!parsed.ok) {
    for (const problem of parsed.problems) {
      console.error(`${source}:${problem.line}: ${problem.message}`);
    }
    return 1;
  }

  let broken = 0;
  for (const row of parsed.rows) {
    if (!existsSync(join(dirname(specPath), row.useCase))) {
      console.error(`${source}:${row.line}: ${row.operation}'s use case ${row.useCase} is not a file beside the spec`);
      broken += 1;
    }
  }

  if (broken > 0) {
    return 1;
  }

  // The table is written before construct is read: construct's operations
  // import it, so a first run, or a new row, needs it on disk to build them.
  const path = join(businessDir, "src", "access.ts");
  const text = emit(parsed.rows, source, SCRIPT);
  if (!check) {
    writeFileSync(path, text);
    console.log(`wrote ${path}`);
  } else {
    const committed = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (committed !== text) {
      console.error(`${path} differs from what ${source} generates; run pnpm gen:access`);
      return 1;
    }
  }

  const built = await builtOperations(constructPath);
  const named = new Set(parsed.rows.map((row) => row.operation));
  for (const operation of built) {
    if (!named.has(operation)) {
      console.error(`${source}: construct builds ${operation}, which has no row; every operation has one`);
      broken += 1;
    }
  }
  for (const row of parsed.rows) {
    if (!built.includes(row.operation)) {
      console.error(`${source}:${row.line}: ${row.operation} has a row, but construct does not build it`);
      broken += 1;
    }
  }
  return broken > 0 ? 1 : 0;
};

process.exitCode = await main(process.argv.slice(2));
