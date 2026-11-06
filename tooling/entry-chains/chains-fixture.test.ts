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
    'import { authenticate } from "./gates/authenticate.ts";',
    'import { requestId } from "./gates/request-id.ts";',
    'import { routing } from "./route.ts";',
    "",
    "export const constructGates = (infra: Infra, config: Config): Gates => [",
    "  requestId,",
    "  authenticate({",
    "    sessions: infra.identityStore,",
    "  }),",
    "];",
    "",
  ].join("\n"),
  "apps/api/src/gates/request-id.ts": "export const requestId = async () => {};\n",
  "apps/api/src/gates/authenticate.ts": "export const authenticate = () => async () => {};\n",
  "apps/api/src/route.ts": 'import { verdict } from "@todo/operations/run.ts";\n\nexport const routing = () => verdict;\n',
  "packages/operations/src/run.ts": "export const run = (name, body) => body;\nexport const verdict = () => undefined;\n",
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
    'import { run } from "../run.ts";',
    "",
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

/** The fixture's list unit, with no port: it reads nothing of its own. */
const portless = [
  'import { run } from "../run.ts";',
  "",
  "/**",
  " * Lists.",
  " *",
  " * Use case: `prd/todo/use-cases/list-todos.md`",
  " */",
  'export const listTodos = () => run("listTodos", async () => ok([]));',
  "",
].join("\n");

describe("readChains on a fixture", () => {
  it("lists the gates first, in construct's order, then the runner, as shared links", () => {
    fixture();
    const shared = read().shared.map((row) => [row.label, row.path, row.symbols.join(", ")]);
    assert.deepEqual(shared.slice(0, 3), [
      ["gates", "apps/api/src/gates/request-id.ts", "requestId"],
      ["gates", "apps/api/src/gates/authenticate.ts", "authenticate"],
      ["runner", "packages/operations/src/run.ts", "run, verdict"],
    ]);
  });

  it("ends the chain of a unit that declares no port at the unit", () => {
    fixture({ "packages/operations/src/todos/list-todos.ts": portless });
    const chain = read().chains[1];
    assert.equal(chain?.line, "GET /todos → getTodos → listTodos");
    assert.deepEqual(
      chain?.rows.map((row) => [row.label, row.symbols.join(", ")]),
      [
        ["use case", ""],
        ["route", "constructRoutes"],
        ["handler", "getTodos"],
        ["rules", "toTodoFilter"],
        ["op", "listTodos"],
      ],
    );
  });

  it("fails on a gate construct does not import from gates/", () => {
    const text = files["apps/api/src/construct.ts"]?.replace('from "./gates/request-id.ts"', 'from "./request-id.ts"') ?? "";
    fixture({ "apps/api/src/construct.ts": text });
    assert.throws(read, /requestId/);
  });

  it("fails on a construct with no constructGates", () => {
    const text = files["apps/api/src/construct.ts"]?.replace("export const constructGates", "export const gates") ?? "";
    fixture({ "apps/api/src/construct.ts": text });
    assert.throws(read, /exactly one "export const constructGates/);
  });

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

  it("follows a port of several methods to each data method, across two stores", () => {
    // The identity store, beside the DbStore (L42); the unit's port reads
    // from one table of each and declares its methods in order.
    fixture({
      "apps/api/src/construct.ts": files["apps/api/src/construct.ts"]?.replace(
        'import { createDbStore } from "@todo/data-d1/store.ts";',
        'import { createIdentityStore } from "@todo/data-d1/identity/store.ts";\nimport { createDbStore } from "@todo/data-d1/store.ts";',
      ) ?? "",
      "packages/data/d1/src/identity/store.ts": [
        'import { sessionStore } from "./sessions.ts";',
        "",
        "export const createIdentityStore = (db: D1Database) => ({",
        "  ...sessionStore(db),",
        "});",
        "",
      ].join("\n"),
      "packages/data/d1/src/identity/sessions.ts": [
        "export const sessionStore = (db: D1Database) => ({",
        "  endSession: async (",
        "    id: string,",
        "  ): Promise<R> => {",
        "    return ok(true);",
        "  },",
        "});",
        "",
      ].join("\n"),
      "packages/operations/src/todos/list-todos.ts": files["packages/operations/src/todos/list-todos.ts"]?.replace(
        "  listTodos(): Promise<R>;",
        "  listTodos(): Promise<R>;\n  endSession(id: string): Promise<R>;",
      ) ?? "",
    });
    const chain = read().chains[1];
    assert.equal(chain?.line, "GET /todos → getTodos → listTodos ⇢ ListStore.listTodos, endSession → d1.listTodos, d1.endSession");
    assert.deepEqual(
      chain?.rows.filter((row) => row.label === "data").map((row) => [row.path, row.symbols.join(", ")]),
      [
        ["packages/data/d1/src/todos.ts", "todoStore.listTodos"],
        ["packages/data/d1/src/identity/sessions.ts", "sessionStore.endSession"],
      ],
    );
  });

  it("fails on a construct that imports no store builder", () => {
    const text = files["apps/api/src/construct.ts"]?.replace('import { createDbStore } from "@todo/data-d1/store.ts";\n', "") ?? "";
    fixture({ "apps/api/src/construct.ts": text });
    assert.throws(read, /imports no store builder/);
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
