// Reads what the entry chain index needs from source text, by a few strict
// patterns and no parser (L24). Each reader takes a file's text and its path,
// and fails with the path when the text does not match: the index never
// guesses a link.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/** A failure the generator reports as it is: a file and what it lacks. */
export class ChainError extends Error {}

/** Fails with the file and what it lacks. */
export const fail = (path: string, message: string): never => {
  throw new ChainError(`${path}: ${message}`);
};

/** One named import: the name the module exports, and the name it is used by here. */
export type Imported = { name: string; local: string; typeOnly: boolean };

/**
 * One `import { ... } from "..."` statement. A namespace import, `import * as
 * x from "..."`, and a bare `import "...";` are known and not read: no link
 * is imported that way.
 */
export type Import = { from: string; names: Imported[] };

/** An import's item: `name`, `name as local`, either after `type`. */
const ITEM = /^(type\s+)?(\w+)(?:\s+as\s+(\w+))?$/;

/**
 * Every named import in a file, in order, across as many lines as each
 * takes. Every line that starts with `import` must be one of the three forms
 * and end in `;`, and every item must be a bare name: a default import, a
 * comment between the braces or a missing `;` fails rather than drop a link.
 */
export const importsOf = (text: string, path: string): Import[] => {
  const found: Import[] = [];
  const read = new Set<number>();
  const named = /^import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)";$/gm;
  for (const match of text.matchAll(named)) {
    read.add(match.index);
    const allTypes = match[1] !== undefined;
    const list = match[2] ?? "";
    const from = match[3] ?? "";
    const names: Imported[] = [];
    for (const raw of list.split(",")) {
      const item = raw.trim();
      if (item === "") {
        continue;
      }
      const parts = ITEM.exec(item);
      if (parts === null) {
        return fail(path, `the import from ${from} has an item that is not a bare name: ${item}`);
      }
      const name = parts[2] ?? "";
      let local = name;
      if (parts[3] !== undefined) {
        local = parts[3];
      }
      names.push({ name, local, typeOnly: allTypes || parts[1] !== undefined });
    }
    found.push({ from, names });
  }
  const unread = /^import\s+(\*\s+as\s+\w+\s+from\s+)?"[^"]+";$/gm;
  for (const match of text.matchAll(unread)) {
    read.add(match.index);
  }
  for (const match of text.matchAll(/^import\b.*$/gm)) {
    if (!read.has(match.index)) {
      return fail(path, `an import is not written "import { ... } from \"...\";": ${match[0]}`);
    }
  }
  return found;
};

/** Whether the file exports a `const` or `type` of that name. */
export const exports = (text: string, name: string) => {
  const declared = new RegExp(`^export (const|type) ${name}\\b`, "m");
  return declared.test(text);
};

/** The use case a unit's doc comment cites (L25): one `Use case:` line, its path in code font. */
export const useCaseOf = (text: string, path: string): string => {
  const cited = [...text.matchAll(/^ \* Use case: `([^`]+)`$/gm)];
  if (cited.length !== 1) {
    return fail(path, `a unit cites exactly one use case in a "Use case: \`path\`" line; found ${cited.length}`);
  }
  const [only] = cited;
  return only?.[1] ?? "";
};

/**
 * Whether an operation declares a port at all. One that declares none reads
 * and writes nothing of its own, so its chain ends at the unit.
 */
export const declaresPort = (text: string) => /^export type \w+Store = \{$/m.test(text);

/** An operation's port: its exported type and the methods it declares. */
export type Port = { name: string; methods: string[] };

/**
 * The port declared in an operation's own file (L6, L24): exactly one
 * `export type <Name>Store = {`, closed by `};`, with one method per line,
 * `  method(`.
 */
export const portOf = (text: string, path: string): Port => {
  const declared = [...text.matchAll(/^export type (\w+Store) = \{\n((?:.*\n)*?)\};$/gm)];
  if (declared.length !== 1) {
    return fail(path, `an operation declares exactly one port as "export type <Name>Store = {"; found ${declared.length}`);
  }
  const [port] = declared;
  const name = port?.[1] ?? "";
  const body = port?.[2] ?? "";
  const methods: string[] = [];
  for (const line of body.split("\n")) {
    if (line === "") {
      continue;
    }
    const method = /^ {2}(\w+)\(/.exec(line);
    if (method === null) {
      return fail(path, `${name} has a line that is not "  method(": ${line.trim()}`);
    }
    methods.push(method[1] ?? "");
  }
  if (methods.length === 0) {
    return fail(path, `${name} declares no method`);
  }
  return { name, methods };
};

/** A table's store in a data package: the exported builder and its methods. */
export type TableStore = { name: string; methods: string[] };

/**
 * The store a data file exports (chapter 8): exactly one
 * `export const <name>Store = (db: D1Database) => ({`, closed by `});`, whose
 * methods are written `  method: async (`. A signature too long for one
 * line closes at the same depth, `  }): Result => {` or `  ): Result => {`.
 * A data method carries the name of the port method it serves.
 */
export const tableStoreOf = (text: string, path: string): TableStore => {
  const declared = [...text.matchAll(/^export const (\w+Store) = \(db: D1Database\) => \(\{\n((?:.*\n)*?)\}\);$/gm)];
  if (declared.length !== 1) {
    return fail(path, `a table's file exports exactly one "export const <name>Store = (db: D1Database) => ({"; found ${declared.length}`);
  }
  const [store] = declared;
  const name = store?.[1] ?? "";
  const body = store?.[2] ?? "";
  const methods: string[] = [];
  for (const line of body.split("\n")) {
    // Only the lines at the store's own depth: what is inside a method is not read.
    if (!/^ {2}\S/.test(line)) {
      continue;
    }
    const method = /^ {2}(\w+): async \(/.exec(line);
    if (method !== null) {
      methods.push(method[1] ?? "");
      continue;
    }
    if (line === "  }," || line.startsWith("  /**") || line.startsWith("  //")) {
      continue;
    }
    // The close of a signature that spans lines.
    if (/^ {2}\}?\): .+ => \{$/.test(line)) {
      continue;
    }
    return fail(path, `${name} has a line that is not "  method: async (", "  }," or a comment: ${line.trim()}`);
  }
  if (methods.length === 0) {
    return fail(path, `${name} has no method written "  method: async ("`);
  }
  return { name, methods };
};

/**
 * The table stores a store spreads, by their local names: exactly one
 * `export const <builder> = (db: D1Database) => ({`, closed by `});`,
 * whose every line is `  ...<name>(db),`. Any other entry could replace a
 * table's method, so it fails. `builder` is `createDbStore` or
 * `createIdentityStore` (L42).
 */
export const spreadsOf = (text: string, path: string, builder = "createDbStore"): string[] => {
  const pattern = new RegExp(`^export const ${builder} = \\(db: D1Database\\) => \\(\\{\n((?:.*\n)*?)\\}\\);$`, "gm");
  const declared = [...text.matchAll(pattern)];
  if (declared.length !== 1) {
    return fail(path, `a store is built by exactly one "export const ${builder} = (db: D1Database) => ({"; found ${declared.length}`);
  }
  const body = declared[0]?.[1] ?? "";
  const spread: string[] = [];
  for (const line of body.split("\n")) {
    if (line === "") {
      continue;
    }
    const entry = /^ {2}\.\.\.(\w+)\(db\),$/.exec(line);
    if (entry === null) {
      return fail(path, `${builder} has a line that is not "  ...<name>Store(db),": ${line.trim()}`);
    }
    spread.push(entry[1] ?? "");
  }
  if (spread.length === 0) {
    return fail(path, `${builder} spreads each table's store as "  ...<name>Store(db),"; found none`);
  }
  return spread;
};

/** A workspace package: its name, its directory, and its `exports` map. */
export type Workspace = { name: string; dir: string; exports: Record<string, string> };

/** Every package under `apps/` and `packages/`, at most two levels down. */
export const workspacesIn = (root: string): Workspace[] => {
  const found: Workspace[] = [];
  const visit = (dir: string, depth: number) => {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      const read = JSON.parse(readFileSync(manifest, "utf8")) as { name: string; exports?: Record<string, string> };
      found.push({ name: read.name, dir, exports: read.exports ?? {} });
      return;
    }
    if (depth === 0) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "node_modules") {
        visit(join(dir, entry.name), depth - 1);
      }
    }
  };
  for (const top of ["apps", "packages"]) {
    visit(join(root, top), 2);
  }
  return found;
};

/** A subpath against one `exports` key: exact, or a pattern with one `*`. */
export const matchExport = (key: string, target: string, subpath: string): string | undefined => {
  const star = key.indexOf("*");
  if (star === -1) {
    if (key === subpath) {
      return target;
    }
    return undefined;
  }
  const before = key.slice(0, star);
  const after = key.slice(star + 1);
  if (!subpath.startsWith(before) || !subpath.endsWith(after)) {
    return undefined;
  }
  const middle = subpath.slice(before.length, subpath.length - after.length);
  return target.replace("*", middle);
};

/** The target a subpath resolves to in an `exports` map, as Node picks it, or `undefined`. */
export const exportTarget = (exports: Record<string, string>, subpath: string): string | undefined => {
  const exact = exports[subpath];
  if (exact !== undefined && !subpath.includes("*")) {
    return exact;
  }
  let best: { prefix: number; target: string } | undefined;
  for (const [key, target] of Object.entries(exports)) {
    const star = key.indexOf("*");
    if (star === -1) {
      continue;
    }
    const resolved = matchExport(key, target, subpath);
    if (resolved === undefined) {
      continue;
    }
    if (best === undefined || star > best.prefix) {
      best = { prefix: star, target: resolved };
    }
  }
  return best?.target;
};

/** The file an import names, from the file that imports it, as a path from the repo root. */
export const resolveImport = (from: string, specifier: string, workspaces: Workspace[]): string => {
  if (specifier.startsWith(".")) {
    return normalize(join(dirname(from), specifier));
  }
  const workspace = workspaces.find(
    (candidate) => specifier === candidate.name || specifier.startsWith(`${candidate.name}/`),
  );
  if (workspace === undefined) {
    return fail(from, `${specifier} is not a package of this repo`);
  }
  let subpath = ".";
  if (specifier !== workspace.name) {
    subpath = `.${specifier.slice(workspace.name.length)}`;
  }
  // As Node picks: an exact key first, then the pattern with the longest part before its `*`.
  const target = exportTarget(workspace.exports, subpath);
  if (target === undefined) {
    return fail(from, `${specifier} is not in the exports of ${workspace.name}`);
  }
  return normalize(join(workspace.dir, target));
};

/**
 * One route as construct writes it: its key, the name its entry point is
 * listed under, the identifier that name is given (itself, unless written
 * `{ name: value }`), its unit's name or `null` for a probe, and its
 * validator's name or `null` when the handler is given none.
 */
export type RouteLine = { key: string; name: string; value: string; unit: string | null; validator: string | null };

const ROUTE = /^ {4}"([A-Z]+ [^"]+)": route\(\{ (\w+)(?:: (\w+))? \}, \{ (\w+) \}(?:, \{ (\w+) \})?\),$/;
const PROBE = /^ {4}"([A-Z]+ [^"]+)": probe\(\{ (\w+)(?:: (\w+))? \}\),$/;

/**
 * The routes `constructRoutes` writes, in order: exactly one
 * `export const constructRoutes = (operations: Operations): Routes => {`,
 * which takes its units as `  const { a, b } = operations;`, then
 * `  return {`, one route per line, `  };`. A unit is always written by its
 * own name, `{ listTodos }`, so it is the operation of that name; so is a
 * validator, `{ toTodoFilter }`, so it is the import of that name.
 */
export const routeLinesOf = (text: string, path: string): RouteLine[] => {
  const declared = [...text.matchAll(/^export const constructRoutes = \(operations: Operations\): Routes => \{\n((?:.*\n)*?)\};$/gm)];
  if (declared.length !== 1) {
    return fail(path, `exactly one "export const constructRoutes = (operations: Operations): Routes => {"; found ${declared.length}`);
  }
  const body = declared[0]?.[1] ?? "";
  const taken = [...body.matchAll(/^ {2}const \{ ([\w, ]+) \} = operations;$/gm)];
  if (taken.length !== 1) {
    return fail(path, `constructRoutes takes its units once, as "  const { a, b } = operations;"; found ${taken.length}`);
  }
  const units = (taken[0]?.[1] ?? "").split(",").map((unit) => unit.trim());

  const lines: RouteLine[] = [];
  let inside = false;
  for (const line of body.split("\n")) {
    if (line === "  return {") {
      inside = true;
      continue;
    }
    if (line === "  };") {
      inside = false;
      continue;
    }
    if (!inside) {
      continue;
    }
    const routed = ROUTE.exec(line);
    if (routed !== null) {
      const name = routed[2] ?? "";
      const unit = routed[4] ?? "";
      if (!units.includes(unit)) {
        return fail(path, `the route ${routed[1]} runs ${unit}, which constructRoutes does not take from operations`);
      }
      lines.push({ key: routed[1] ?? "", name, value: routed[3] ?? name, unit, validator: routed[5] ?? null });
      continue;
    }
    const probed = PROBE.exec(line);
    if (probed !== null) {
      const name = probed[2] ?? "";
      lines.push({ key: probed[1] ?? "", name, value: probed[3] ?? name, unit: null, validator: null });
      continue;
    }
    return fail(
      path,
      `a route is written "    \\"KEY\\": route({ handler }, { unit }),", or route({ handler }, { unit }, { validator }), or probe({ handler }): ${line.trim()}`,
    );
  }
  if (lines.length === 0) {
    return fail(path, "constructRoutes returns no route written one per line");
  }
  return lines;
};

/** One operation as `constructOperations` writes it: its name and the builder it calls. */
export type OperationLine = { name: string; builder: string };

/**
 * The operations construct builds: exactly one
 * `export const constructOperations = (infra: Infra): Operations => ({`,
 * closed by `});`, one `  name: builder({ ... }),` per line, or
 * `  name: builder(),` for an operation that needs no port.
 */
export const operationLinesOf = (text: string, path: string): OperationLine[] => {
  const declared = [...text.matchAll(/^export const constructOperations = \(infra: Infra\): Operations => \(\{\n((?:.*\n)*?)\}\);$/gm)];
  if (declared.length !== 1) {
    return fail(path, `exactly one "export const constructOperations = (infra: Infra): Operations => ({"; found ${declared.length}`);
  }
  const lines: OperationLine[] = [];
  for (const line of (declared[0]?.[1] ?? "").split("\n")) {
    if (line === "") {
      continue;
    }
    const built = /^ {2}(\w+): (\w+)\((?:\{ .* \})?\),$/.exec(line);
    if (built === null) {
      return fail(path, `an operation is written "  name: builder({ ... }),", or "  name: builder(),": ${line.trim()}`);
    }
    lines.push({ name: built[1] ?? "", builder: built[2] ?? "" });
  }
  return lines;
};

/**
 * The gates construct lists, in the order they run (L38): each element of
 * `export const constructGates = (infra: Infra, config: Config): Gates => [`,
 * closed by `];`, written at two spaces as `  gate,` or `  gate(`. The
 * arguments under a gate are deeper, so they are not gates.
 */
export const gateLinesOf = (text: string, path: string): string[] => {
  const declared = [...text.matchAll(/^export const constructGates = \(infra: Infra, config: Config\): Gates => \[\n((?:.*\n)*?)\];$/gm)];
  if (declared.length !== 1) {
    return fail(path, `exactly one "export const constructGates = (infra: Infra, config: Config): Gates => ["; found ${declared.length}`);
  }
  const gates: string[] = [];
  for (const line of (declared[0]?.[1] ?? "").split("\n")) {
    const gate = /^ {2}([a-z]\w*)(?:,|\()/.exec(line);
    if (gate !== null) {
      gates.push(gate[1] ?? "");
    }
  }
  if (gates.length === 0) {
    return fail(path, "constructGates lists no gate");
  }
  return gates;
};

/** The import of `name` whose specifier passes `where`, which must be exactly one, value not type. */
export const importOf = (
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
