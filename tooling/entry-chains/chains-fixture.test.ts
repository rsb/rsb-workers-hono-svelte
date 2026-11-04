// readChains against a small repo written to a temporary directory, one per
// test, so each failure can be made by changing one file. The chains are read
// from the repo root, so each test runs in its fixture's root.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { readChains } from "./chains.ts";
import type { RouteRow } from "./routes.ts";

const home = process.cwd();
after(() => process.chdir(home));

const exportsAll = (name: string) => JSON.stringify({ name, exports: { "./*": "./src/*" } });

const files: Record<string, string> = {
  "apps/api/package.json": JSON.stringify({ name: "@todo/api" }),
  "apps/api/src/index.ts": 'import { serve } from "./http.ts";\n',
  "apps/api/src/construct.ts": [
    'import { createDbStore } from "@todo/data-d1/store.ts";',
    'import { listTodos } from "@todo/operations/todos/list-todos.ts";',
    'import { toTodoFilter } from "@todo/valid/todos/todo-filter.ts";',
    'import { notFound } from "./app/handlers/errors/errors.ts";',
    'import { getHealth } from "./app/handlers/health/health.ts";',
    'import { getTodos } from "./app/handlers/todos/get-todos.ts";',
    "",
  ].join("\n"),
  "apps/api/src/app/handlers/health/health.ts": "export const getHealth = (c: Context) => c.json({});\n",
  "apps/api/src/app/handlers/todos/get-todos.ts": [
    'import { success } from "../present.ts";',
    "",
    'import type { toTodoFilter } from "@todo/valid/todos/todo-filter.ts";',
    "",
    "export const getTodos = (listTodos: ListTodos, toTodoFilter: ToTodoFilter) => async (c: Context) => success(c, await listTodos());",
    "",
  ].join("\n"),
  "packages/operations/package.json": exportsAll("@todo/operations"),
  "packages/operations/src/todos/list-todos.ts": [
    "export type ListStore = {",
    "  listTodos(): Promise<R>;",
    "};",
    "",
    "/**",
    " * Lists.",
    " *",
    " * Use case: `prd/todo/use-cases/list-todos.md`",
    " */",
    "export const listTodos = (deps: { dbStore: ListStore }) => () => deps.dbStore.listTodos();",
    "",
  ].join("\n"),
  "prd/todo/use-cases/list-todos.md": "# List todos\n",
  "packages/valid/package.json": exportsAll("@todo/valid"),
  "packages/valid/src/todos/todo-filter.ts": 'export const toTodoFilter = (candidate: unknown) => candidate;\ntoTodoFilter.rules = [];\n',
  "packages/data/d1/package.json": exportsAll("@todo/data-d1"),
  "packages/data/d1/src/store.ts": [
    'import { todoStore } from "./todos.ts";',
    "",
    "export const createDbStore = (db: D1Database) => ({",
    "  ...todoStore(db),",
    "});",
    "",
  ].join("\n"),
  "packages/data/d1/src/todos.ts": [
    'import { queryAll } from "./driver.ts";',
    "",
    "export const todoStore = (db: D1Database) => ({",
    "  listTodos: async () => {",
    "    return queryAll(db);",
    "  },",
    "});",
    "",
  ].join("\n"),
};

const routes: RouteRow[] = [
  { key: "GET /health", name: "getHealth", unit: null, validator: null },
  { key: "GET /todos", name: "getTodos", unit: "listTodos", validator: { name: "toTodoFilter", rules: [] } },
];

/** Writes the fixture, with `changed` over the files above, and runs the test in its root. */
const fixture = (changed: Record<string, string> = {}) => {
  const root = mkdtempSync(join(tmpdir(), "entry-chains-"));
  for (const [path, text] of Object.entries({ ...files, ...changed })) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  process.chdir(root);
};

const read = () => readChains("apps/api/src/construct.ts", routes);

describe("readChains on a fixture", () => {
  it("follows a route to its data method", () => {
    fixture();
    const index = read();
    assert.equal(index.chains[1]?.line, "GET /todos → getTodos → listTodos ⇢ ListStore.listTodos → d1.listTodos");
  });

  it("reads the rules row from the validator the route is given", () => {
    fixture();
    const rules = read().chains[1]?.rows.filter((row) => row.label === "rules");
    assert.deepEqual(rules, [{ label: "rules", path: "packages/valid/src/todos/todo-filter.ts", symbols: ["toTodoFilter"] }]);
  });

  it("fails on a handler that imports its validator instead of being given it", () => {
    const text = files["apps/api/src/app/handlers/todos/get-todos.ts"]?.replace("import type { toTodoFilter }", "import { toTodoFilter }") ?? "";
    fixture({ "apps/api/src/app/handlers/todos/get-todos.ts": text });
    assert.throws(read, /get-todos\.ts: imports toTodoFilter from valid; a handler is given its validator by construct/);
  });

  it("fails on a handler that does not export the route's name", () => {
    fixture({ "apps/api/src/app/handlers/todos/get-todos.ts": "export const listAll = () => () => undefined;\n" });
    assert.throws(read, /get-todos\.ts: does not export getTodos/);
  });

  it("fails on a unit that cites a use case that does not exist", () => {
    const text = files["packages/operations/src/todos/list-todos.ts"]?.replace("list-todos.md", "list-all.md") ?? "";
    fixture({ "packages/operations/src/todos/list-todos.ts": text });
    assert.throws(read, /cites prd\/todo\/use-cases\/list-all\.md, which does not exist/);
  });

  it("fails on a port method with no data method of its name", () => {
    const text = files["packages/data/d1/src/todos.ts"]?.replace("  listTodos: async", "  listAll: async") ?? "";
    fixture({ "packages/data/d1/src/todos.ts": text });
    assert.throws(read, /ListStore\.listTodos has no data method of the same name/);
  });

  it("fails on a data method two table stores have", () => {
    fixture({
      "packages/data/d1/src/store.ts": [
        'import { tagStore } from "./tags.ts";',
        'import { todoStore } from "./todos.ts";',
        "",
        "export const createDbStore = (db: D1Database) => ({",
        "  ...todoStore(db),",
        "  ...tagStore(db),",
        "});",
        "",
      ].join("\n"),
      "packages/data/d1/src/tags.ts": files["packages/data/d1/src/todos.ts"]?.replace("todoStore", "tagStore") ?? "",
    });
    assert.throws(read, /tags\.ts: tagStore\.listTodos: another table store already has listTodos/);
  });

  it("fails on a construct that imports the unit twice", () => {
    const text = `${files["apps/api/src/construct.ts"]}import { listTodos as again } from "@todo/operations/todos/list-todos.ts";\n`;
    fixture({ "apps/api/src/construct.ts": text });
    assert.throws(read, /imports listTodos as a unit 2 times/);
  });

  it("fails on a construct with no failure handlers", () => {
    const text = files["apps/api/src/construct.ts"]?.replace('import { notFound } from "./app/handlers/errors/errors.ts";\n', "") ?? "";
    fixture({ "apps/api/src/construct.ts": text });
    assert.throws(read, /imports the failure handlers from one file/);
  });
});
