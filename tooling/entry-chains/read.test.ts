import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ChainError,
  exportTarget,
  importsOf,
  operationLinesOf,
  portOf,
  resolveImport,
  routeLinesOf,
  spreadsOf,
  tableStoreOf,
  useCaseOf,
  workspacesIn,
} from "./read.ts";

describe("importsOf", () => {
  it("reads names, aliases and type-only imports, across lines", () => {
    const text = [
      'import { a, b as c, type D } from "./x.ts";',
      'import type { E } from "@todo/y/e.ts";',
      "import {",
      "  f,",
      "  g,",
      '} from "../z.ts";',
      'import * as h from "./h.ts";',
    ].join("\n");

    assert.deepEqual(importsOf(text, "x.ts"), [
      {
        from: "./x.ts",
        names: [
          { name: "a", local: "a", typeOnly: false },
          { name: "b", local: "c", typeOnly: false },
          { name: "D", local: "D", typeOnly: true },
        ],
      },
      { from: "@todo/y/e.ts", names: [{ name: "E", local: "E", typeOnly: true }] },
      {
        from: "../z.ts",
        names: [
          { name: "f", local: "f", typeOnly: false },
          { name: "g", local: "g", typeOnly: false },
        ],
      },
    ]);
  });

  it("knows a bare import and reads nothing from it", () => {
    assert.deepEqual(importsOf('import "./setup.ts";\n', "x.ts"), []);
  });

  it("fails on a comment between the braces, rather than read it as a name", () => {
    const text = 'import {\n  a, // the first\n  b,\n} from "./x.ts";\n';
    assert.throws(() => importsOf(text, "x.ts"), /x\.ts: the import from \.\/x\.ts has an item that is not a bare name/);
  });

  it("fails on a default import beside named ones, rather than drop the line", () => {
    const text = 'import rules, { newTodo } from "@todo/valid/todos/new-todo.ts";\n';
    assert.throws(() => importsOf(text, "x.ts"), /x\.ts: an import is not written/);
  });

  it("fails on an import with no closing semicolon", () => {
    assert.throws(() => importsOf('import { a } from "./x.ts"\n', "x.ts"), /an import is not written/);
  });
});

describe("useCaseOf", () => {
  it("reads the one use case a unit cites", () => {
    const text = "/**\n * Adds.\n *\n * Use case: `prd/todo/use-cases/todos/add-a-todo.md`\n */";
    assert.equal(useCaseOf(text, "op.ts"), "prd/todo/use-cases/todos/add-a-todo.md");
  });

  it("fails on a unit that cites none", () => {
    assert.throws(() => useCaseOf("/** Adds. */", "op.ts"), ChainError);
  });

  it("fails on a unit that cites two", () => {
    const text = "/**\n * Use case: `a.md`\n * Use case: `b.md`\n */";
    assert.throws(() => useCaseOf(text, "op.ts"), /found 2/);
  });
});

describe("portOf", () => {
  it("reads the port declared in the operation's file", () => {
    const text = "export type UpdateStore = {\n  updateTodo(id: string): Promise<R>;\n};\n";
    assert.deepEqual(portOf(text, "op.ts"), { name: "UpdateStore", methods: ["updateTodo"] });
  });

  it("fails when no port is declared there", () => {
    const text = 'import type { UpdateStore } from "./ports.ts";\n';
    assert.throws(() => portOf(text, "op.ts"), /op\.ts: an operation declares exactly one port/);
  });

  it("fails on a port line it cannot read, rather than skip it", () => {
    const text = "export type UpdateStore = {\n  updateTodo: (id: string) => Promise<R>;\n};\n";
    assert.throws(() => portOf(text, "op.ts"), /a line that is not "  method\("/);
  });
});

describe("tableStoreOf", () => {
  const store = [
    "export const todoStore = (db: D1Database) => ({",
    "  /** Lists. */",
    "  listTodos: async (filter: TodoFilter): Promise<R> => {",
    "    return selectRaw(db);",
    "  },",
    "",
    "  countTodos: async (): Promise<R> => {",
    "    return countRaw(db);",
    "  },",
    "});",
    "",
  ].join("\n");

  it("reads the store's methods, and none of its private helpers", () => {
    assert.deepEqual(tableStoreOf(store, "todos.ts"), { name: "todoStore", methods: ["listTodos", "countTodos"] });
  });

  it("fails on a method it cannot read, rather than skip it", () => {
    const text = store.replace("  countTodos: async (): Promise<R> => {", "  countTodos(): Promise<R> {");
    assert.throws(() => tableStoreOf(text, "todos.ts"), /todoStore has a line that is not "  method: async \("/);
  });

  it("fails on a file with no store written as the pattern says", () => {
    const text = "export function todoStore(db: D1Database) {\n  return {};\n}\n";
    assert.throws(() => tableStoreOf(text, "todos.ts"), /todos\.ts: a table's file exports exactly one/);
  });
});

describe("spreadsOf", () => {
  it("reads the table stores a DbStore spreads", () => {
    const text = "export const createDbStore = (db: D1Database) => ({\n  ...todoStore(db),\n  ...tagStore(db),\n});\n";
    assert.deepEqual(spreadsOf(text, "store.ts"), ["todoStore", "tagStore"]);
  });

  it("fails on a DbStore that spreads none", () => {
    assert.throws(() => spreadsOf("export const createDbStore = () => ({});\n", "store.ts"), ChainError);
  });

  it("fails on an entry that is not a spread, since it could replace a table's method", () => {
    const text = "export const createDbStore = (db: D1Database) => ({\n  ...todoStore(db),\n  updateTodo: async () => ok(),\n});\n";
    assert.throws(() => spreadsOf(text, "store.ts"), /createDbStore has a line that is not/);
  });
});

describe("exportTarget", () => {
  const exports = { "./*": "./src/*", "./todos/*": "./src/todo/*", "./index.ts": "./src/main.ts" };

  it("takes an exact key before any pattern", () => {
    assert.equal(exportTarget(exports, "./index.ts"), "./src/main.ts");
  });

  it("takes the pattern with the longest part before its star, as Node does", () => {
    assert.equal(exportTarget(exports, "./todos/a.ts"), "./src/todo/a.ts");
    assert.equal(exportTarget(exports, "./tags/a.ts"), "./src/tags/a.ts");
  });

  it("finds nothing when no key matches", () => {
    assert.equal(exportTarget({ "./todos/*": "./src/*" }, "./tags/a.ts"), undefined);
  });
});

describe("routeLinesOf", () => {
  const construct = (lines: string[]) =>
    [
      "export const constructRoutes = (operations: Operations): Routes => {",
      "  // The units.",
      "  const { listTodos, deleteTodo } = operations;",
      "",
      "  return {",
      ...lines,
      "  };",
      "};",
      "",
    ].join("\n");

  it("reads each route and probe, with the value a name is given", () => {
    const text = construct([
      '    "GET /health": probe({ getHealth }),',
      '    "GET /todos": route({ getTodos }, { listTodos }, { toTodoFilter }),',
      '    "DELETE /todos/{id}": route({ deleteTodo: deleteTodoHandler }, { deleteTodo }),',
    ]);
    assert.deepEqual(routeLinesOf(text, "c.ts"), [
      { key: "GET /health", name: "getHealth", value: "getHealth", unit: null, validator: null },
      { key: "GET /todos", name: "getTodos", value: "getTodos", unit: "listTodos", validator: "toTodoFilter" },
      { key: "DELETE /todos/{id}", name: "deleteTodo", value: "deleteTodoHandler", unit: "deleteTodo", validator: null },
    ]);
  });

  it("fails on a validator given under another name", () => {
    const text = construct(['    "GET /todos": route({ getTodos }, { listTodos }, { toTodoFilter: toNewTodo }),']);
    assert.throws(() => routeLinesOf(text, "c.ts"), /c\.ts: a route is written/);
  });

  it("fails on a unit given under another name", () => {
    const text = construct(['    "GET /todos": route({ getTodos }, { listTodos: deleteTodo }),']);
    assert.throws(() => routeLinesOf(text, "c.ts"), /c\.ts: a route is written/);
  });

  it("fails on a unit construct does not take from operations", () => {
    const text = construct(['    "GET /todos": route({ getTodos }, { countTodos }),']);
    assert.throws(() => routeLinesOf(text, "c.ts"), /runs countTodos, which constructRoutes does not take/);
  });

  it("fails on a route split over lines", () => {
    const text = construct(['    "GET /todos": route(', "      { getTodos },", "      { listTodos },", "    ),"]);
    assert.throws(() => routeLinesOf(text, "c.ts"), /a route is written/);
  });
});

describe("operationLinesOf", () => {
  const construct = (lines: string[]) =>
    ["export const constructOperations = (infra: Infra): Operations => ({", ...lines, "});", ""].join("\n");

  it("reads each operation and the builder it calls", () => {
    const text = construct(["  listTodos: listTodos({ dbStore: infra.dbStore }),"]);
    assert.deepEqual(operationLinesOf(text, "c.ts"), [{ name: "listTodos", builder: "listTodos" }]);
  });

  it("reads an operation built with no port", () => {
    const text = construct(["  currentSession: currentSession(),"]);
    assert.deepEqual(operationLinesOf(text, "c.ts"), [{ name: "currentSession", builder: "currentSession" }]);
  });

  it("fails on an operation it cannot read", () => {
    const text = construct(["  listTodos: build(listTodos, infra),"]);
    assert.throws(() => operationLinesOf(text, "c.ts"), /an operation is written/);
  });
});

describe("resolveImport", () => {
  const workspaces = workspacesIn(".");

  it("resolves a relative import from the importing file", () => {
    assert.equal(resolveImport("apps/api/src/construct.ts", "./app/x.ts", workspaces), "apps/api/src/app/x.ts");
  });

  it("resolves a package import through its exports map", () => {
    assert.equal(
      resolveImport("apps/api/src/construct.ts", "@todo/valid/todos/new-todo.ts", workspaces),
      "packages/valid/src/todos/new-todo.ts",
    );
  });

  it("fails on a path the package does not export", () => {
    assert.throws(
      () => resolveImport("apps/api/src/construct.ts", "@todo/valid/fields/decode.ts", workspaces),
      /not in the exports of @todo\/valid/,
    );
  });
});
