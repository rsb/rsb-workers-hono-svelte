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

describe("updateTodo", () => {
  it("binds the id, the title and completed as 0 or 1, in placeholder order", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await todoStore(db).updateTodo("id-1", { title: "buy bread", completed: true });
    await todoStore(db).updateTodo("id-1", { completed: false });

    expect(prepared.map((statement) => statement.bound)).toEqual([
      ["id-1", "buy bread", 1],
      ["id-1", null, 0],
    ]);
  });

  it("binds NULL for each field the patch leaves out", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await todoStore(db).updateTodo("id-1", { title: "buy bread" });

    expect(prepared.map((statement) => statement.bound)).toEqual([["id-1", "buy bread", null]]);
  });

  it("reads the returned row as the todo it now is", async () => {
    const { db } = fakeD1({ rows: [{ id: "id-1", title: "buy milk", completed: 1 }] });

    expect(await todoStore(db).updateTodo("id-1", { completed: true })).toEqual({
      ok: true,
      value: { id: "id-1", title: "buy milk", completed: true },
    });
  });

  it("reports no todo when no row came back, without deciding why", async () => {
    const { db } = fakeD1({ rows: [] });

    expect(await todoStore(db).updateTodo("id-9", { completed: true })).toEqual({ ok: true, value: null });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const updated = await todoStore(db).updateTodo("id-1", { completed: true });

    expect(updated).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "update todo: D1_ERROR: Network connection lost." },
    });
  });
});

describe("setAllCompleted", () => {
  it("binds completed as 0 or 1, and reads the list in the same batch", async () => {
    const done = fakeD1();
    await todoStore(done.db).setAllCompleted(true);
    const active = fakeD1();
    await todoStore(active.db).setAllCompleted(false);

    expect(done.batches).toEqual([2]);
    expect(done.prepared[0]?.bound).toEqual([1]);
    expect(active.prepared[0]?.bound).toEqual([0]);
  });

  it("reads every row the batch lists as a todo", async () => {
    const rows = [
      { id: "id-1", title: "buy milk", completed: 1 },
      { id: "id-2", title: "walk dog", completed: 1 },
    ];
    const { db } = fakeD1({ rows });

    expect(await todoStore(db).setAllCompleted(true)).toEqual({
      ok: true,
      value: [
        { id: "id-1", title: "buy milk", completed: true },
        { id: "id-2", title: "walk dog", completed: true },
      ],
    });
  });

  it("passes a D1 failure up, named by the batch", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    expect(await todoStore(db).setAllCompleted(true)).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "set all completed: D1_ERROR: Network connection lost." },
    });
  });
});

describe("deleteTodo", () => {
  it("binds the id", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await todoStore(db).deleteTodo("id-1");

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.bound).toEqual(["id-1"]);
  });

  it("reports deleted when one row changed", async () => {
    const { db } = fakeD1({ changes: 1 });

    expect(await todoStore(db).deleteTodo("id-1")).toEqual({ ok: true, value: true });
  });

  it("reports not deleted when no row changed, without deciding why", async () => {
    const { db } = fakeD1({ changes: 0 });

    expect(await todoStore(db).deleteTodo("id-9")).toEqual({ ok: true, value: false });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const deleted = await todoStore(db).deleteTodo("id-1");

    expect(deleted).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "delete todo: D1_ERROR: Network connection lost." },
    });
  });
});

describe("deleteCompleted", () => {
  it("deletes and reads the list in the same batch, binding nothing", async () => {
    const { db, prepared, batches } = fakeD1();

    await todoStore(db).deleteCompleted();

    expect(batches).toEqual([2]);
    expect(prepared.map((each) => each.bound)).toEqual([[], []]);
  });

  it("reads every row the batch lists as a todo", async () => {
    const rows = [{ id: "id-2", title: "walk dog", completed: 0 }];
    const { db } = fakeD1({ rows });

    expect(await todoStore(db).deleteCompleted()).toEqual({
      ok: true,
      value: [{ id: "id-2", title: "walk dog", completed: false }],
    });
  });

  it("passes a D1 failure up, named by the batch", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    expect(await todoStore(db).deleteCompleted()).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "delete completed: D1_ERROR: Network connection lost." },
    });
  });
});
