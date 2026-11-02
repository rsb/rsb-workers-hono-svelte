import { describe, expect, it } from "vitest";
import { toRow, toTodo, todoStore } from "../../src/todos.ts";
import { fakeD1 } from "./fake-d1.ts";

describe("toRow and toTodo", () => {
  it("stores completed as 0 or 1", () => {
    expect(toRow({ id: "id-1", title: "buy milk", completed: false }).completed).toBe(0);
    expect(toRow({ id: "id-1", title: "buy milk", completed: true }).completed).toBe(1);
  });

  it("reads a row back as the todo it was", () => {
    const todo = { id: "id-1", title: "buy milk", completed: true };
    expect(toTodo(toRow(todo))).toEqual(todo);
  });
});

describe("addTodoUnlessFull", () => {
  const todo = { id: "id-1", title: "buy milk", completed: false };

  it("binds the row and then the limit, in placeholder order", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await todoStore(db).addTodoUnlessFull(todo, 500);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.bound).toEqual(["id-1", "buy milk", 0, 500]);
  });

  it("reports inserted when one row changed", async () => {
    const { db } = fakeD1({ changes: 1 });

    expect(await todoStore(db).addTodoUnlessFull(todo, 500)).toEqual({ ok: true, value: true });
  });

  it("reports not inserted when no row changed, without deciding why", async () => {
    const { db } = fakeD1({ changes: 0 });

    expect(await todoStore(db).addTodoUnlessFull(todo, 500)).toEqual({ ok: true, value: false });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const added = await todoStore(db).addTodoUnlessFull(todo, 500);

    expect(added).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "insert todo unless full: D1_ERROR: Network connection lost." },
    });
  });
});

describe("listTodos", () => {
  it("reads every row as a todo, in the order D1 returns them", async () => {
    const rows = [
      { id: "id-1", title: "buy milk", completed: 0 },
      { id: "id-2", title: "walk dog", completed: 1 },
    ];
    const { db } = fakeD1({ rows });

    expect(await todoStore(db).listTodos()).toEqual({
      ok: true,
      value: [
        { id: "id-1", title: "buy milk", completed: false },
        { id: "id-2", title: "walk dog", completed: true },
      ],
    });
  });

  it("reports an empty list as an empty array", async () => {
    const { db } = fakeD1({ rows: [] });

    expect(await todoStore(db).listTodos()).toEqual({ ok: true, value: [] });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: no such table: todos: SQLITE_ERROR") });

    const listed = await todoStore(db).listTodos();

    expect(listed).toMatchObject({
      ok: false,
      error: { kind: "server", message: "select todos: D1_ERROR: no such table: todos: SQLITE_ERROR" },
    });
  });
});
