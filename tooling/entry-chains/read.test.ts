import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChainError, importsOf, portOf, resolveImport, spreadsOf, tableStoreOf, useCaseOf, workspacesIn } from "./read.ts";

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

    assert.deepEqual(importsOf(text), [
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
});

describe("useCaseOf", () => {
  it("reads the one use case a unit cites", () => {
    const text = "/**\n * Adds.\n *\n * Use case: `prd/todo/use-cases/todos/add-a-todo.md`\n */";
    assert.equal(useCaseOf(text, "op.ts"), "prd/todo/use-cases/todos/add-a-todo.md");
  });

  it("fails on a unit that cites none", () => {
    assert.throws(() => useCaseOf("/** Adds. */", "op.ts"), ChainError);
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
      () => resolveImport("apps/api/src/construct.ts", "@todo/valid/fields/title.ts", workspaces),
      /not in the exports of @todo\/valid/,
    );
  });
});
