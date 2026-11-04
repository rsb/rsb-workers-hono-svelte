// Reads an api's route table from its construct, as data (L24, L26). It
// builds the routes with a store that is never called, and keeps only what
// each route says about itself: its key, its entry point's name, its unit,
// and its validator's name with the rules that validator carries (L33).
// This is the one extractor that feeds both the OpenAPI document's
// `operationId` and `x-unit` and `apps/api/entry-chains.md`.
//
// A name is only data: `route({ getTodoCounts: getTodos }, …)` type-checks
// and is named `getTodoCounts`. So the routes built are checked against the
// construct's text, where each name is seen next to the value it is given:
// every name must be the value's own, as its import and its operation say.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type RouteLine, fail, importOf, importsOf, operationLinesOf, routeLinesOf } from "./read.ts";

/**
 * One route: its key as the spec writes it, its entry point, its unit or
 * `null` for a probe, and its validator or `null` when its handler is given
 * none. The rules are read from the validator the route holds, not written
 * a second time (L33).
 */
export type RouteRow = {
  key: string;
  name: string;
  unit: string | null;
  validator: { name: string; rules: string[] } | null;
};

type Construct = {
  constructOperations: (infra: { dbStore: unknown; newId: () => string }) => unknown;
  constructRoutes: (operations: unknown) => Record<string, unknown>;
};

/** A store whose every method fails when called: building routes calls none. */
const unusedStore = new Proxy(
  {},
  {
    get: (_, method) => () => {
      throw new Error(`entry-chains: the store's ${String(method)} was called while reading the routes`);
    },
  },
);

/** A route as construct built it, or a failure naming its key. */
export const rowOf = (path: string, key: string, route: unknown): RouteRow => {
  if (typeof route !== "object" || route === null) {
    return fail(path, `the route ${key} is not an object`);
  }
  const { name, unit, validator } = route as { name?: unknown; unit?: unknown; validator?: unknown };
  if (typeof name !== "string" || name === "") {
    return fail(path, `the route ${key} has no name`);
  }
  if (unit !== null && (typeof unit !== "string" || unit === "")) {
    return fail(path, `the route ${key} has a unit that is neither a name nor null`);
  }
  if (validator === null) {
    return { key, name, unit, validator: null };
  }
  const held = validator as { name?: unknown; value?: { rules?: unknown } } | undefined;
  const rules = held?.value?.rules;
  if (typeof held?.name !== "string" || held.name === "") {
    return fail(path, `the route ${key} has a validator that is neither a named validator nor null`);
  }
  if (!Array.isArray(rules) || !rules.every((rule) => typeof rule === "string")) {
    return fail(path, `the route ${key}'s validator ${held.name} carries no rules`);
  }
  return { key, name, unit, validator: { name: held.name, rules: [...rules] } };
};

/** Fails unless the identifier a route's entry point is given is the import of the handler of its name. */
const checkHandler = (path: string, imports: ReturnType<typeof importsOf>, line: RouteLine) => {
  const handler = importOf(path, imports, line.name, (specifier) => specifier.startsWith("./"), "an entry point");
  if (handler.local !== line.value) {
    return fail(path, `the route ${line.key} is named ${line.name} but is given ${line.value}, which is not ${line.name}`);
  }
};

/**
 * Fails unless the routes built are the routes written, in order, and each
 * name is the value's own: the entry point is the handler of that name in
 * the app's files, the unit is the operation of that name, built by the
 * builder of that name, and the validator is the one of that name in `valid`.
 */
export const checkWritten = (path: string, text: string, rows: RouteRow[]) => {
  const imports = importsOf(text, path);
  const written = routeLinesOf(text, path);
  const operations = operationLinesOf(text, path);

  const asText = (row: { key: string; name: string; unit: string | null; validator: string | null }) =>
    `${row.key} ${row.name} ${row.unit} ${row.validator}`;
  const built = rows.map((row) => ({ ...row, validator: row.validator?.name ?? null }));
  if (built.map(asText).join("\n") !== written.map(asText).join("\n")) {
    return fail(path, "the routes constructRoutes builds are not the routes it writes, one per line");
  }

  const names = new Set<string>();
  for (const line of written) {
    if (names.has(line.name)) {
      return fail(path, `two routes are named ${line.name}; an entry point names one route`);
    }
    names.add(line.name);
    checkHandler(path, imports, line);
    if (line.validator !== null) {
      // Written `{ name }`, so the identifier is the name; it must be valid's validator of that name.
      const validator = importOf(path, imports, line.validator, (specifier) => specifier.startsWith("@todo/valid/"), "a validator");
      if (validator.local !== line.validator) {
        return fail(path, `the route ${line.key} is given ${line.validator}, which is not valid's ${line.validator}`);
      }
    }
    if (line.unit === null) {
      continue;
    }
    const operation = operations.find((found) => found.name === line.unit);
    if (operation === undefined) {
      return fail(path, `the route ${line.key} runs ${line.unit}, which constructOperations does not build`);
    }
  }

  for (const operation of operations) {
    const builder = importOf(
      path,
      imports,
      operation.name,
      (specifier) => specifier.startsWith("@todo/operations/"),
      "an operation's builder",
    );
    if (builder.local !== operation.builder) {
      return fail(path, `the operation ${operation.name} is built by ${operation.builder}, not by ${operation.name}'s builder`);
    }
  }
};

/**
 * The routes of the construct at `constructPath`, in the order construct
 * lists them. Construct imports the generated contract, so the contract on
 * disk is the one it reads.
 */
export const readRoutes = async (constructPath: string): Promise<RouteRow[]> => {
  const url = pathToFileURL(resolve(constructPath)).href;
  const construct = (await import(url)) as Construct;
  const infra = { dbStore: unusedStore, newId: () => "" };
  const operations = construct.constructOperations(infra);
  const routes = construct.constructRoutes(operations);

  const rows: RouteRow[] = [];
  for (const [key, route] of Object.entries(routes)) {
    rows.push(rowOf(constructPath, key, route));
  }
  checkWritten(constructPath, readFileSync(constructPath, "utf8"), rows);
  return rows;
};
