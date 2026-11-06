import { describe, expect, it } from "vitest";
import { toRow, toTodo, todoStore } from "../../src/todos.ts";
import { fakeD1 } from "./fake-d1.ts";

/** The scope every call below is given: one owner's rows. */
const own = { ownerId: "u1" };

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

  it("binds the row, the owner and then the limit, in placeholder order", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await todoStore(db).addTodoUnlessFull(own, todo, 500);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.bound).toEqual(["id-1", "buy milk", 0, "u1", 500]);
    expect(prepared[0]?.sql).toContain("(SELECT COUNT(*) FROM todos WHERE user_id = ?4) < ?5");
  });

  it("reports inserted when one row changed", async () => {
    const { db } = fakeD1({ changes: 1 });

    expect(await todoStore(db).addTodoUnlessFull(own, todo, 500)).toEqual({ ok: true, value: true });
  });

  it("reports not inserted when no row changed, without deciding why", async () => {
    const { db } = fakeD1({ changes: 0 });

    expect(await todoStore(db).addTodoUnlessFull(own, todo, 500)).toEqual({ ok: true, value: false });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const added = await todoStore(db).addTodoUnlessFull(own, todo, 500);

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

    expect(await todoStore(db).listTodos(own, {})).toEqual({
      ok: true,
      value: [
        { id: "id-1", title: "buy milk", completed: false },
        { id: "id-2", title: "walk dog", completed: true },
      ],
    });
  });

  it("reports an empty list as an empty array", async () => {
    const { db } = fakeD1({ rows: [] });

    expect(await todoStore(db).listTodos(own, {})).toEqual({ ok: true, value: [] });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: no such table: todos: SQLITE_ERROR") });

    const listed = await todoStore(db).listTodos(own, {});

    expect(listed).toMatchObject({
      ok: false,
      error: { kind: "server", message: "select todos: D1_ERROR: no such table: todos: SQLITE_ERROR" },
    });
  });
});

describe("listTodos with a filter", () => {
  it("lists every one of the owner's todos when the filter is empty, binding only the owner", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await todoStore(db).listTodos(own, {});

    expect(prepared[0]?.sql).not.toContain("completed =");
    expect(prepared[0]?.sql).toContain("WHERE user_id = ?1");
    expect(prepared[0]?.bound).toEqual(["u1"]);
  });

  it("binds completed as 0 or 1, then the owner", async () => {
    const done = fakeD1({ rows: [] });
    await todoStore(done.db).listTodos(own, { completed: true });
    const active = fakeD1({ rows: [] });
    await todoStore(active.db).listTodos(own, { completed: false });

    expect(done.prepared[0]?.sql).toContain("WHERE completed = ?1 AND user_id = ?2");
    expect(done.prepared[0]?.bound).toEqual([1, "u1"]);
    expect(active.prepared[0]?.bound).toEqual([0, "u1"]);
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const listed = await todoStore(db).listTodos(own, { completed: true });

    expect(listed).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "select todos by completed: D1_ERROR: Network connection lost." },
    });
  });
});

describe("countTodos", () => {
  it("reads the one row as the counts, binding only the owner", async () => {
    const { db, prepared } = fakeD1({ rows: [{ active: 2, completed: 1 }] });

    const counted = await todoStore(db).countTodos(own);

    expect(counted).toEqual({ ok: true, value: { active: 2, completed: 1 } });
    expect(prepared[0]?.bound).toEqual(["u1"]);
  });

  it("reports a server failure when no row came back", async () => {
    const { db } = fakeD1({ rows: [] });

    const counted = await todoStore(db).countTodos(own);

    expect(counted).toMatchObject({ ok: false, error: { kind: "server", message: "count todos: no row came back" } });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const counted = await todoStore(db).countTodos(own);

    expect(counted).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "count todos: D1_ERROR: Network connection lost." },
    });
  });
});

describe("updateTodo", () => {
  it("binds the id, the title, completed as 0 or 1 and the owner, in placeholder order", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await todoStore(db).updateTodo(own, "id-1", { title: "buy bread", completed: true });
    await todoStore(db).updateTodo(own, "id-1", { completed: false });

    expect(prepared.map((statement) => statement.bound)).toEqual([
      ["id-1", "buy bread", 1, "u1"],
      ["id-1", null, 0, "u1"],
    ]);
  });

  it("binds NULL for each field the patch leaves out", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await todoStore(db).updateTodo(own, "id-1", { title: "buy bread" });

    expect(prepared.map((statement) => statement.bound)).toEqual([["id-1", "buy bread", null, "u1"]]);
  });

  it("reads the returned row as the todo it now is", async () => {
    const { db } = fakeD1({ rows: [{ id: "id-1", title: "buy milk", completed: 1 }] });

    expect(await todoStore(db).updateTodo(own, "id-1", { completed: true })).toEqual({
      ok: true,
      value: { id: "id-1", title: "buy milk", completed: true },
    });
  });

  it("reports no todo when no row came back, without deciding why", async () => {
    const { db } = fakeD1({ rows: [] });

    expect(await todoStore(db).updateTodo(own, "id-9", { completed: true })).toEqual({ ok: true, value: null });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const updated = await todoStore(db).updateTodo(own, "id-1", { completed: true });

    expect(updated).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "update todo: D1_ERROR: Network connection lost." },
    });
  });
});

describe("setAllCompleted", () => {
  it("binds completed as 0 or 1 and the owner, and reads the owner's list in the same batch", async () => {
    const done = fakeD1();
    await todoStore(done.db).setAllCompleted(own, true);
    const active = fakeD1();
    await todoStore(active.db).setAllCompleted(own, false);

    expect(done.batches).toEqual([2]);
    expect(done.prepared.map((each) => each.bound)).toEqual([[1, "u1"], ["u1"]]);
    expect(active.prepared[0]?.bound).toEqual([0, "u1"]);
  });

  it("reads every row the batch lists as a todo", async () => {
    const rows = [
      { id: "id-1", title: "buy milk", completed: 1 },
      { id: "id-2", title: "walk dog", completed: 1 },
    ];
    const { db } = fakeD1({ rows });

    expect(await todoStore(db).setAllCompleted(own, true)).toEqual({
      ok: true,
      value: [
        { id: "id-1", title: "buy milk", completed: true },
        { id: "id-2", title: "walk dog", completed: true },
      ],
    });
  });

  it("passes a D1 failure up, named by the batch", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    expect(await todoStore(db).setAllCompleted(own, true)).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "set all completed: D1_ERROR: Network connection lost." },
    });
  });
});

describe("deleteTodo", () => {
  it("binds the id and the owner", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await todoStore(db).deleteTodo(own, "id-1");

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.bound).toEqual(["id-1", "u1"]);
    expect(prepared[0]?.sql).toContain("WHERE id = ?1 AND user_id = ?2");
  });

  it("reports deleted when one row changed", async () => {
    const { db } = fakeD1({ changes: 1 });

    expect(await todoStore(db).deleteTodo(own, "id-1")).toEqual({ ok: true, value: true });
  });

  it("reports not deleted when no row changed, without deciding why", async () => {
    const { db } = fakeD1({ changes: 0 });

    expect(await todoStore(db).deleteTodo(own, "id-9")).toEqual({ ok: true, value: false });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const deleted = await todoStore(db).deleteTodo(own, "id-1");

    expect(deleted).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "delete todo: D1_ERROR: Network connection lost." },
    });
  });
});

describe("deleteCompleted", () => {
  it("deletes and reads the owner's list in the same batch, binding only the owner", async () => {
    const { db, prepared, batches } = fakeD1();

    await todoStore(db).deleteCompleted(own);

    expect(batches).toEqual([2]);
    expect(prepared.map((each) => each.bound)).toEqual([["u1"], ["u1"]]);
  });

  it("reads every row the batch lists as a todo", async () => {
    const rows = [{ id: "id-2", title: "walk dog", completed: 0 }];
    const { db } = fakeD1({ rows });

    expect(await todoStore(db).deleteCompleted(own)).toEqual({
      ok: true,
      value: [{ id: "id-2", title: "walk dog", completed: false }],
    });
  });

  it("passes a D1 failure up, named by the batch", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    expect(await todoStore(db).deleteCompleted(own)).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "delete completed: D1_ERROR: Network connection lost." },
    });
  });
});

describe("a scope of every row", () => {
  const any = { any: true } as const;

  // Each call is the owner's but for its scope: the term is `TRUE` and the
  // owner's bind is gone, so every other value keeps its placeholder.
  it("is the fixed term TRUE, binding nothing for it", async () => {
    const { db, prepared } = fakeD1({ rows: [{ active: 0, completed: 0 }], changes: 1 });
    const store = todoStore(db);

    await store.listTodos(any, {});
    await store.listTodos(any, { completed: true });
    await store.countTodos(any);
    await store.updateTodo(any, "id-1", { completed: true });
    await store.deleteTodo(any, "id-1");

    expect(prepared.map((each) => each.bound)).toEqual([[], [1], [], ["id-1", null, 1], ["id-1"]]);
    for (const each of prepared) {
      expect(each.sql).toContain("TRUE");
      expect(each.sql).not.toContain("user_id");
    }
  });
});
