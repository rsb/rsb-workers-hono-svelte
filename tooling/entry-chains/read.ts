// Reads what the entry chain index needs from source text, by a few strict
// patterns and no parser (L24). Each reader takes a file's text and its path,
// and fails with the path when the text does not match: the index never
// guesses a link.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/** A failure the generator reports as it is: a file and what it lacks. */
export class ChainError extends Error {}

const fail = (path: string, message: string): never => {
  throw new ChainError(`${path}: ${message}`);
};

/** One named import: the name the module exports, and the name it is used by here. */
export type Imported = { name: string; local: string; typeOnly: boolean };

/** One `import { ... } from "..."` statement. Namespace and default imports are not read. */
export type Import = { from: string; names: Imported[] };

/** Every named import in a file, in order, across as many lines as each takes. */
export const importsOf = (text: string): Import[] => {
  const found: Import[] = [];
  const statement = /^import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)";/gm;
  for (const match of text.matchAll(statement)) {
    const allTypes = match[1] !== undefined;
    const list = match[2] ?? "";
    const from = match[3] ?? "";
    const names: Imported[] = [];
    for (const raw of list.split(",")) {
      const item = raw.trim();
      if (item === "") {
        continue;
      }
      const typeOnly = allTypes || item.startsWith("type ");
      const bare = item.replace(/^type\s+/, "");
      const [name = "", alias] = bare.split(/\s+as\s+/);
      let local = name;
      if (alias !== undefined) {
        local = alias;
      }
      names.push({ name, local, typeOnly });
    }
    found.push({ from, names });
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
 * methods are written `  method: async (`. A data method carries the name of
 * the port method it serves.
 */
export const tableStoreOf = (text: string, path: string): TableStore => {
  const declared = [...text.matchAll(/^export const (\w+Store) = \(db: D1Database\) => \(\{\n((?:.*\n)*?)\}\);$/gm)];
  if (declared.length !== 1) {
    return fail(path, `a table's file exports exactly one "export const <name>Store = (db: D1Database) => ({"; found ${declared.length}`);
  }
  const [store] = declared;
  const name = store?.[1] ?? "";
  const body = store?.[2] ?? "";
  const methods = [...body.matchAll(/^ {2}(\w+): async \(/gm)].map((method) => method[1] ?? "");
  if (methods.length === 0) {
    return fail(path, `${name} has no method written "  method: async ("`);
  }
  return { name, methods };
};

/** The table stores a `DbStore` spreads, by their local names: `  ...todoStore(db),`. */
export const spreadsOf = (text: string, path: string): string[] => {
  const spread = [...text.matchAll(/^ {2}\.\.\.(\w+)\(db\),$/gm)].map((match) => match[1] ?? "");
  if (spread.length === 0) {
    return fail(path, `a DbStore spreads each table's store as "  ...<name>Store(db),"; found none`);
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
const matchExport = (key: string, target: string, subpath: string): string | undefined => {
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
  for (const [key, target] of Object.entries(workspace.exports)) {
    const resolved = matchExport(key, target, subpath);
    if (resolved !== undefined) {
      return normalize(join(workspace.dir, resolved));
    }
  }
  return fail(from, `${specifier} is not in the exports of ${workspace.name}`);
};
