import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type RouteRow, checkWritten, rowOf } from "./routes.ts";

/** A construct's text, with the lines that differ from test to test. */
const construct = (lines: { imports?: string[]; validators?: string[]; operations?: string[]; routes?: string[] }) =>
  [
    'import { countTodos } from "@todo/operations/todos/count-todos.ts";',
    'import { listTodos } from "@todo/operations/todos/list-todos.ts";',
    ...(lines.validators ?? ['import { toTodoFilter } from "@todo/valid/todos/todo-filter.ts";']),
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
      '    "GET /todos": route({ getTodos }, { listTodos }, { toTodoFilter }),',
      '    "GET /todos/counts": route({ getTodoCounts }, { countTodos }),',
    ]),
    "  };",
    "};",
    "",
  ].join("\n");

const rows: RouteRow[] = [
  { key: "GET /health", name: "getHealth", unit: null, validator: null },
  { key: "GET /todos", name: "getTodos", unit: "listTodos", validator: { name: "toTodoFilter", rules: [] } },
  { key: "GET /todos/counts", name: "getTodoCounts", unit: "countTodos", validator: null },
];

describe("checkWritten", () => {
  it("passes when every name is its value's own", () => {
    assert.doesNotThrow(() => checkWritten("c.ts", construct({}), rows));
  });

  it("fails on a handler given under another handler's name", () => {
    const text = construct({
      routes: [
        '    "GET /health": probe({ getHealth }),',
        '    "GET /todos": route({ getTodos }, { listTodos }, { toTodoFilter }),',
        '    "GET /todos/counts": route({ getTodoCounts: getTodos }, { countTodos }),',
      ],
    });
    assert.throws(() => checkWritten("c.ts", text, rows), /named getTodoCounts but is given getTodos/);
  });

  it("fails on two routes with one entry point's name", () => {
    const text = construct({
      routes: [
        '    "GET /health": probe({ getHealth }),',
        '    "GET /todos": route({ getTodos }, { listTodos }, { toTodoFilter }),',
        '    "GET /todos/counts": route({ getTodos }, { countTodos }),',
      ],
    });
    const named = [rows[0], rows[1], { key: "GET /todos/counts", name: "getTodos", unit: "countTodos", validator: null }] as RouteRow[];
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

  it("fails on a validator not imported from valid", () => {
    const text = construct({ validators: ['import { toTodoFilter } from "./filter.ts";'] });
    assert.throws(() => checkWritten("c.ts", text, rows), /imports toTodoFilter as a validator 0 times/);
  });

  it("fails on a validator imported under another name", () => {
    const text = construct({
      validators: [
        'import { toTodoFilter as filter } from "@todo/valid/todos/todo-filter.ts";',
        'import { toNewTodo as toTodoFilter } from "@todo/valid/todos/new-todo.ts";',
      ],
    });
    assert.throws(() => checkWritten("c.ts", text, rows), /is given toTodoFilter, which is not valid's toTodoFilter/);
  });

  it("fails when the validator built is not the validator written", () => {
    const built = [rows[0], { ...rows[1], validator: null }, rows[2]] as RouteRow[];
    assert.throws(() => checkWritten("c.ts", construct({}), built), /are not the routes it writes/);
  });
});

describe("rowOf", () => {
  it("keeps a route's key, name and unit, and no validator", () => {
    const route = { name: "getTodos", unit: "listTodos", validator: null, handler: () => undefined };
    assert.deepEqual(rowOf("c.ts", "GET /todos", route), { key: "GET /todos", name: "getTodos", unit: "listTodos", validator: null });
  });

  it("reads the rules from the validator the route holds", () => {
    const toNewTodo = Object.assign(() => undefined, { rules: ["title.length"] });
    const route = { name: "postTodos", unit: "addTodo", validator: { name: "toNewTodo", value: toNewTodo }, handler: () => undefined };
    assert.deepEqual(rowOf("c.ts", "POST /todos", route).validator, { name: "toNewTodo", rules: ["title.length"] });
  });

  it("fails on a validator that carries no rules", () => {
    const route = { name: "postTodos", unit: "addTodo", validator: { name: "toNewTodo", value: () => undefined }, handler: () => undefined };
    assert.throws(() => rowOf("c.ts", "POST /todos", route), /the route POST \/todos's validator toNewTodo carries no rules/);
  });

  it("fails on a route with no name, rather than drop its operationId", () => {
    assert.throws(() => rowOf("c.ts", "GET /todos", { unit: "listTodos" }), /c\.ts: the route GET \/todos has no name/);
  });

  it("fails on a unit that is neither a name nor null", () => {
    assert.throws(() => rowOf("c.ts", "GET /todos", { name: "getTodos" }), /neither a name nor null/);
  });
});
