import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type RouteRow, checkWritten, rowOf } from "./routes.ts";

/** A construct's text, with the lines that differ from test to test. */
const construct = (lines: { imports?: string[]; operations?: string[]; routes?: string[] }) =>
  [
    'import { countTodos } from "@todo/operations/todos/count-todos.ts";',
    'import { listTodos } from "@todo/operations/todos/list-todos.ts";',
    ...(lines.imports ?? [
      'import { getHealth } from "./app/handlers/health/health.ts";',
      'import { getTodoCounts } from "./app/handlers/todos/get-todo-counts.ts";',
      'import { getTodos } from "./app/handlers/todos/get-todos.ts";',
    ]),
    "",
    "export const constructOperations = (infra: Infra): Operations => ({",
    ...(lines.operations ?? [
      "  listTodos: listTodos({ dbStore: infra.dbStore }),",
      "  countTodos: countTodos({ dbStore: infra.dbStore }),",
    ]),
    "});",
    "",
    "export const constructRoutes = (operations: Operations): Routes => {",
    "  const { listTodos, countTodos } = operations;",
    "",
    "  return {",
    ...(lines.routes ?? [
      '    "GET /health": probe({ getHealth }),',
      '    "GET /todos": route({ getTodos }, { listTodos }),',
      '    "GET /todos/counts": route({ getTodoCounts }, { countTodos }),',
    ]),
    "  };",
    "};",
    "",
  ].join("\n");

const rows: RouteRow[] = [
  { key: "GET /health", name: "getHealth", unit: null },
  { key: "GET /todos", name: "getTodos", unit: "listTodos" },
  { key: "GET /todos/counts", name: "getTodoCounts", unit: "countTodos" },
];

describe("checkWritten", () => {
  it("passes when every name is its value's own", () => {
    assert.doesNotThrow(() => checkWritten("c.ts", construct({}), rows));
  });

  it("fails on a handler given under another handler's name", () => {
    const text = construct({
      routes: [
        '    "GET /health": probe({ getHealth }),',
        '    "GET /todos": route({ getTodos }, { listTodos }),',
        '    "GET /todos/counts": route({ getTodoCounts: getTodos }, { countTodos }),',
      ],
    });
    assert.throws(() => checkWritten("c.ts", text, rows), /named getTodoCounts but is given getTodos/);
  });

  it("fails on two routes with one entry point's name", () => {
    const text = construct({
      routes: [
        '    "GET /health": probe({ getHealth }),',
        '    "GET /todos": route({ getTodos }, { listTodos }),',
        '    "GET /todos/counts": route({ getTodos }, { countTodos }),',
      ],
    });
    const named = [rows[0], rows[1], { key: "GET /todos/counts", name: "getTodos", unit: "countTodos" }] as RouteRow[];
    assert.throws(() => checkWritten("c.ts", text, named), /two routes are named getTodos/);
  });

  it("fails on an operation built by another operation's builder", () => {
    const text = construct({
      operations: [
        "  listTodos: listTodos({ dbStore: infra.dbStore }),",
        "  countTodos: listTodos({ dbStore: infra.dbStore }),",
      ],
    });
    assert.throws(() => checkWritten("c.ts", text, rows), /countTodos is built by listTodos/);
  });

  it("fails on a route whose unit is not built", () => {
    const text = construct({ operations: ["  listTodos: listTodos({ dbStore: infra.dbStore }),"] });
    assert.throws(() => checkWritten("c.ts", text, rows), /runs countTodos, which constructOperations does not build/);
  });

  it("fails when the routes built are not the routes written", () => {
    const built = [rows[0], rows[2], rows[1]] as RouteRow[];
    assert.throws(() => checkWritten("c.ts", construct({}), built), /are not the routes it writes/);
  });

  it("fails on an entry point not imported from the app's own files", () => {
    const text = construct({
      imports: [
        'import { getHealth } from "./app/handlers/health/health.ts";',
        'import { getTodoCounts } from "./app/handlers/todos/get-todo-counts.ts";',
        'import { getTodos } from "@todo/elsewhere/get-todos.ts";',
      ],
    });
    assert.throws(() => checkWritten("c.ts", text, rows), /imports getTodos as an entry point 0 times/);
  });
});

describe("rowOf", () => {
  it("keeps a route's key, name and unit", () => {
    const route = { name: "getTodos", unit: "listTodos", handler: () => undefined };
    assert.deepEqual(rowOf("c.ts", "GET /todos", route), { key: "GET /todos", name: "getTodos", unit: "listTodos" });
  });

  it("fails on a route with no name, rather than drop its operationId", () => {
    assert.throws(() => rowOf("c.ts", "GET /todos", { unit: "listTodos" }), /c\.ts: the route GET \/todos has no name/);
  });

  it("fails on a unit that is neither a name nor null", () => {
    assert.throws(() => rowOf("c.ts", "GET /todos", { name: "getTodos" }), /neither a name nor null/);
  });
});
