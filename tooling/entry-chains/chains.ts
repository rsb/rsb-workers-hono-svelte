// Follows every route from construct down to the data method it reaches
// (L24). The route table gives each entry point and its unit; the imports
// give their files; two strict patterns give the rest: the port declared in
// the operation's own file, and the data method named as the port method.
// Private symbols (Stmt, Raw) are not links. What every chain shares is
// listed once: the gates, in the order construct lists them, the runner
// every unit is wrapped in, the HTTP module, the failure handlers, the
// handlers' helpers and the driver. A unit that declares no port reads
// nothing of its own, so its chain ends at the unit.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { RouteRow } from "./routes.ts";
import {
  type Import,
  type Workspace,
  declaresPort,
  exports,
  fail,
  gateLinesOf,
  importOf,
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

const read = (path: string) => readFileSync(path, "utf8");

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
  const storeImports = importsOf(storeText, storePath);
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
    for (const helper of relativeImports(tablePath, importsOf(tableText, tablePath), workspaces)) {
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
  const constructImports = importsOf(constructText, constructPath);
  const shared = new Map<string, Row>();

  // What startup imports from the HTTP module, and the failure handlers construct hands it.
  const indexPath = join(dirname(constructPath), "index.ts");
  for (const imported of relativeImports(indexPath, importsOf(read(indexPath), indexPath), workspaces)) {
    if (imported.path.endsWith("/http.ts")) {
      share(shared, "http", imported.path, imported.names);
    }
  }
  const failures = constructImports.filter((statement) => statement.from.includes("/handlers/errors/"));
  if (failures.length !== 1) {
    return fail(constructPath, `imports the failure handlers from one file under handlers/errors/; found ${failures.length}`);
  }
  for (const statement of failures) {
    const values = statement.names.filter((imported) => !imported.typeOnly).map((imported) => imported.name);
    share(shared, "errors", resolveImport(constructPath, statement.from, workspaces), values);
  }

  // The gates: each a binding in the app's own files, under gates/.
  for (const gate of gateLinesOf(constructText, constructPath)) {
    const imported = importOf(constructPath, constructImports, gate, (specifier) => specifier.startsWith("./gates/"), "a gate");
    share(shared, "gates", resolveImport(constructPath, imported.from, workspaces), [gate]);
  }

  // The runner: what the route helpers take from it, to answer a unit's row
  // before its handler; each unit adds what it is wrapped in.
  const runner = (path: string, imports: Import[]) => {
    for (const statement of imports) {
      const values = statement.names.filter((imported) => !imported.typeOnly).map((imported) => imported.name);
      const resolved = statement.from.startsWith(".") || statement.from.startsWith("@todo/") ? resolveImport(path, statement.from, workspaces) : "";
      if (resolved.endsWith("/run.ts") && values.length > 0) {
        share(shared, "runner", resolved, values);
      }
    }
  };
  const helpers = importOf(constructPath, constructImports, "routing", (specifier) => specifier.startsWith("./"), "the route helpers");
  const helpersPath = resolveImport(constructPath, helpers.from, workspaces);
  runner(helpersPath, importsOf(read(helpersPath), helpersPath));

  const methods = dataMethods(constructPath, constructImports, workspaces, shared);
  const routePath = relative(root, constructPath);
  const chains: Chain[] = [];

  for (const route of routes) {
    // The entry point: imported by construct from the app's own files, under the name it exports.
    const handler = importOf(constructPath, constructImports, route.name, (specifier) => specifier.startsWith("./"), "an entry point");
    const handlerPath = resolveImport(constructPath, handler.from, workspaces);
    const handlerText = read(handlerPath);
    if (!exports(handlerText, route.name)) {
      return fail(handlerPath, `does not export ${route.name}, the name construct gives the route ${route.key}`);
    }
    const handlerImports = importsOf(handlerText, handlerPath);
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

    // The rules: the validator construct gives the entry point to build its
    // input (L27, L33). A handler that imports one itself would apply rules
    // the route does not say it applies.
    for (const statement of handlerImports) {
      const values = statement.names.filter((imported) => !imported.typeOnly);
      if (statement.from.startsWith("@todo/valid/") && values.length > 0) {
        return fail(handlerPath, `imports ${values.map((imported) => imported.name).join(", ")} from valid; a handler is given its validator by construct`);
      }
    }
    const rules: Row[] = [];
    if (route.validator !== null) {
      const validator = importOf(
        constructPath,
        constructImports,
        route.validator.name,
        (specifier) => specifier.startsWith("@todo/valid/"),
        "a validator",
      );
      rules.push({ label: "rules", path: resolveImport(constructPath, validator.from, workspaces), symbols: [route.validator.name] });
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
      return fail(unitPath, `does not export ${route.unit}, the unit construct gives the route ${route.key}`);
    }
    runner(unitPath, importsOf(unitText, unitPath));
    const useCase = useCaseOf(unitText, unitPath);
    if (!existsSync(join(root, useCase))) {
      return fail(unitPath, `cites ${useCase}, which does not exist`);
    }
    const head = [
      { label: "use case", path: useCase, symbols: [] },
      { label: "route", path: routePath, symbols: ["constructRoutes"] },
      { label: "handler", path: handlerPath, symbols: [route.name] },
      ...rules,
    ];
    if (!declaresPort(unitText)) {
      chains.push({
        key: route.key,
        line: `${route.key} → ${route.name} → ${route.unit}`,
        rows: [...head, { label: "op", path: unitPath, symbols: [route.unit] }],
      });
      continue;
    }
    const port = portOf(unitText, unitPath);
    if (port.methods.length !== 1) {
      return fail(unitPath, `${port.name} has ${port.methods.length} methods; the index writes a chain through one`);
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
        ...head,
        { label: "op", path: unitPath, symbols: [route.unit, port.name] },
        { label: "data", path: data.path, symbols: [`${data.store}.${portMethod}`] },
      ],
    });
  }

  // In the order a request meets them. The gates keep construct's order,
  // which is the order they run; the rest of a label is by path.
  const order = ["gates", "runner", "http", "errors", "handlers", "driver"];
  const sharedRows = [...shared.values()].sort((a, b) => {
    const byLabel = order.indexOf(a.label) - order.indexOf(b.label);
    if (byLabel !== 0) {
      return byLabel;
    }
    if (a.label === "gates") {
      return 0;
    }
    if (a.path < b.path) {
      return -1;
    }
    if (a.path > b.path) {
      return 1;
    }
    return 0;
  });
  for (const row of sharedRows) {
    row.symbols.sort();
  }
  return { shared: sharedRows, chains };
};
