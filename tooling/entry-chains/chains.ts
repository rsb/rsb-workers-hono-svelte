// Follows every route from construct down to the data method it reaches
// (L24). The route table gives each entry point and its unit; the imports
// give their files; two strict patterns give the rest: the port declared in
// the operation's own file, and the data method named as the port method.
// Private symbols (Stmt, Raw) are not links. The driver helpers every chain
// shares are listed once.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { RouteRow } from "./routes.ts";
import {
  ChainError,
  type Import,
  type Workspace,
  exports,
  importsOf,
  portOf,
  resolveImport,
  spreadsOf,
  tableStoreOf,
  useCaseOf,
  workspacesIn,
} from "./read.ts";

/** One row of a block: what the link is, its file, and the symbols that are the link. */
export type Row = { label: string; path: string; symbols: string[] };

/** One entry point: its key, its entry chain in one line, and a row per link. */
export type Chain = { key: string; line: string; rows: Row[] };

/** The whole index: the links every chain shares, then each entry point. */
export type Chains = { shared: Row[]; chains: Chain[] };

const fail = (path: string, message: string): never => {
  throw new ChainError(`${path}: ${message}`);
};

const read = (path: string) => readFileSync(path, "utf8");

/** The import of `name` whose file passes `where`, which must be exactly one. */
const importOf = (
  path: string,
  imports: Import[],
  name: string,
  where: (specifier: string) => boolean,
  what: string,
): { from: string; local: string } => {
  const matches: { from: string; local: string }[] = [];
  for (const statement of imports) {
    if (!where(statement.from)) {
      continue;
    }
    for (const imported of statement.names) {
      if (imported.name === name && !imported.typeOnly) {
        matches.push({ from: statement.from, local: imported.local });
      }
    }
  }
  if (matches.length !== 1) {
    return fail(path, `imports ${name} as ${what} ${matches.length} times; it must import it once`);
  }
  return matches[0] as { from: string; local: string };
};

/** Adds a file's symbols to a shared row, keeping each symbol once. */
const share = (shared: Map<string, Row>, label: string, path: string, symbols: string[]) => {
  let row = shared.get(path);
  if (row === undefined) {
    row = { label, path, symbols: [] };
    shared.set(path, row);
  }
  for (const symbol of symbols) {
    if (!row.symbols.includes(symbol)) {
      row.symbols.push(symbol);
    }
  }
};

/** The value names a file imports from a relative path, by the file they resolve to. */
const relativeImports = (path: string, imports: Import[], workspaces: Workspace[]) => {
  const found: { path: string; names: string[] }[] = [];
  for (const statement of imports) {
    if (!statement.from.startsWith(".")) {
      continue;
    }
    const names = statement.names.filter((imported) => !imported.typeOnly).map((imported) => imported.name);
    if (names.length > 0) {
      found.push({ path: resolveImport(path, statement.from, workspaces), names });
    }
  }
  return found;
};

/** Where each data method lives: the table store that has it, and the data package it is in. */
type DataMethod = { path: string; store: string; packageName: string };

/**
 * Every data method the `DbStore` holds, from the store file construct
 * builds it with: each table store it spreads, and that store's methods.
 * Each table file's driver imports are shared links.
 */
const dataMethods = (constructPath: string, constructImports: Import[], workspaces: Workspace[], shared: Map<string, Row>) => {
  const builder = importOf(
    constructPath,
    constructImports,
    "createDbStore",
    (specifier) => specifier.startsWith("@todo/data-"),
    "the DbStore's builder",
  );
  const storePath = resolveImport(constructPath, builder.from, workspaces);
  const storeText = read(storePath);
  const storeImports = importsOf(storeText);
  const packageName = /^packages\/data\/([^/]+)\//.exec(storePath)?.[1];
  if (packageName === undefined) {
    return fail(storePath, "a DbStore is built in a package under packages/data/");
  }

  const methods = new Map<string, DataMethod>();
  for (const local of spreadsOf(storeText, storePath)) {
    const table = importOf(storePath, storeImports, local, (specifier) => specifier.startsWith("./"), "a table store");
    const tablePath = resolveImport(storePath, table.from, workspaces);
    const tableText = read(tablePath);
    const store = tableStoreOf(tableText, tablePath);
    for (const method of store.methods) {
      if (methods.has(method)) {
        return fail(tablePath, `${store.name}.${method}: another table store already has ${method}`);
      }
      methods.set(method, { path: tablePath, store: store.name, packageName });
    }
    for (const helper of relativeImports(tablePath, importsOf(tableText), workspaces)) {
      if (helper.path.endsWith("/driver.ts")) {
        share(shared, "driver", helper.path, helper.names);
      }
    }
  }
  return methods;
};

/** Every route's chain, and the links they share, from the construct at `constructPath`. */
export const readChains = (constructPath: string, routes: readonly RouteRow[], root = "."): Chains => {
  const workspaces = workspacesIn(root);
  const constructText = read(constructPath);
  const constructImports = importsOf(constructText);
  const shared = new Map<string, Row>();

  // What startup imports from the HTTP module, and the failure handlers construct hands it.
  const indexPath = join(dirname(constructPath), "index.ts");
  for (const imported of relativeImports(indexPath, importsOf(read(indexPath)), workspaces)) {
    if (imported.path.endsWith("/http.ts")) {
      share(shared, "http", imported.path, imported.names);
    }
  }
  const failures = constructImports.find((statement) => statement.from.includes("/handlers/errors/"));
  if (failures !== undefined) {
    const failuresPath = resolveImport(constructPath, failures.from, workspaces);
    share(shared, "errors", failuresPath, failures.names.map((imported) => imported.name));
  }

  const methods = dataMethods(constructPath, constructImports, workspaces, shared);
  const routePath = relative(root, constructPath);
  const chains: Chain[] = [];

  for (const route of routes) {
    // The entry point: imported by construct from the app's own files, under the name it exports.
    const handler = importOf(constructPath, constructImports, route.name, (specifier) => specifier.startsWith("./"), "an entry point");
    const handlerPath = resolveImport(constructPath, handler.from, workspaces);
    const handlerText = read(handlerPath);
    if (!exports(handlerText, route.name)) {
      fail(handlerPath, `does not export ${route.name}, the name construct gives the route ${route.key}`);
    }
    const handlerImports = importsOf(handlerText);
    for (const helper of relativeImports(handlerPath, handlerImports, workspaces)) {
      share(shared, "handlers", helper.path, helper.names);
    }

    if (route.unit === null) {
      chains.push({
        key: route.key,
        line: `${route.key} → ${route.name}`,
        rows: [
          { label: "route", path: routePath, symbols: ["constructRoutes"] },
          { label: "probe", path: handlerPath, symbols: [route.name] },
        ],
      });
      continue;
    }

    // The rules: what the entry point takes from `valid` to build its input (L27).
    const rules: Row[] = [];
    for (const statement of handlerImports) {
      if (!statement.from.startsWith("@todo/valid/")) {
        continue;
      }
      const names = statement.names.filter((imported) => !imported.typeOnly).map((imported) => imported.name);
      if (names.length > 0) {
        rules.push({ label: "rules", path: resolveImport(handlerPath, statement.from, workspaces), symbols: names });
      }
    }

    // The unit: imported by construct from operations, under the name the route gives it.
    const unit = importOf(
      constructPath,
      constructImports,
      route.unit,
      (specifier) => specifier.startsWith("@todo/operations/"),
      "a unit",
    );
    const unitPath = resolveImport(constructPath, unit.from, workspaces);
    const unitText = read(unitPath);
    if (!exports(unitText, route.unit)) {
      fail(unitPath, `does not export ${route.unit}, the unit construct gives the route ${route.key}`);
    }
    const useCase = useCaseOf(unitText, unitPath);
    if (!existsSync(join(root, useCase))) {
      fail(unitPath, `cites ${useCase}, which does not exist`);
    }
    const port = portOf(unitText, unitPath);
    if (port.methods.length !== 1) {
      fail(unitPath, `${port.name} has ${port.methods.length} methods; the index writes a chain through one`);
    }
    const portMethod = port.methods[0] as string;
    const data = methods.get(portMethod);
    if (data === undefined) {
      return fail(unitPath, `${port.name}.${portMethod} has no data method of the same name in the DbStore`);
    }

    const line = [
      `${route.key} → ${route.name} → ${route.unit}`,
      `⇢ ${port.name}.${portMethod} → ${data.packageName}.${portMethod}`,
    ].join(" ");
    chains.push({
      key: route.key,
      line,
      rows: [
        { label: "use case", path: useCase, symbols: [] },
        { label: "route", path: routePath, symbols: ["constructRoutes"] },
        { label: "handler", path: handlerPath, symbols: [route.name] },
        ...rules,
        { label: "op", path: unitPath, symbols: [route.unit, port.name] },
        { label: "data", path: data.path, symbols: [`${data.store}.${portMethod}`] },
      ],
    });
  }

  const order = ["http", "errors", "handlers", "driver"];
  const sharedRows = [...shared.values()].sort((a, b) => {
    const byLabel = order.indexOf(a.label) - order.indexOf(b.label);
    if (byLabel !== 0) {
      return byLabel;
    }
    return a.path.localeCompare(b.path);
  });
  for (const row of sharedRows) {
    row.symbols.sort();
  }
  return { shared: sharedRows, chains };
};
