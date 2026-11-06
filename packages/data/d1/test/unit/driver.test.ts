import { describe, expect, it } from "vitest";
import { execute, executeBatch, queryAll, writeThenQueryAll } from "../../src/driver.ts";
import { fakeD1 } from "./fake-d1.ts";

describe("queryAll", () => {
  it("returns every row", async () => {
    const rows = [{ id: "id-1" }, { id: "id-2" }];
    const { db } = fakeD1({ rows });

    const read = await queryAll(() => db.prepare("SELECT id FROM todos"), "select ids");

    expect(read).toEqual({ ok: true, value: rows });
  });

  it("classifies a D1 error, named by the context", async () => {
    const d1 = new Error("D1_ERROR: Network connection lost.");
    const { db } = fakeD1({ throws: d1 });

    const read = await queryAll(() => db.prepare("SELECT id FROM todos"), "select ids");

    expect(read).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "select ids: D1_ERROR: Network connection lost.", cause: d1 },
    });
  });
});

describe("execute", () => {
  it("returns how many rows changed", async () => {
    const { db } = fakeD1({ changes: 1 });

    const written = await execute(() => db.prepare("DELETE FROM todos"), "delete todos");

    expect(written).toEqual({ ok: true, value: 1 });
  });

  it("classifies a D1 error, named by the context", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: no such table: todos: SQLITE_ERROR") });

    const written = await execute(() => db.prepare("DELETE FROM todos"), "delete todos");

    expect(written).toMatchObject({
      ok: false,
      error: { kind: "server", message: "delete todos: D1_ERROR: no such table: todos: SQLITE_ERROR" },
    });
  });

  it("classifies an error thrown while binding, as it builds the statement inside the try", async () => {
    const { db } = fakeD1({ throwsOnBind: new Error("D1_TYPE_ERROR: Type 'undefined' not supported") });

    const written = await execute(() => db.prepare("DELETE FROM todos WHERE id = ?1").bind(undefined), "delete todo");

    expect(written).toMatchObject({ ok: false, error: { kind: "server" } });
  });
});

describe("writeThenQueryAll", () => {
  it("runs the write and the read as one batch, and returns the read's rows", async () => {
    const rows = [{ id: "id-1" }];
    const { db, prepared, batches } = fakeD1({ rows });

    const read = await writeThenQueryAll(
      db,
      () => db.prepare("UPDATE todos SET completed = 1"),
      () => db.prepare("SELECT id FROM todos"),
      "set all",
    );

    expect(read).toEqual({ ok: true, value: rows });
    expect(batches).toEqual([2]);
    expect(prepared.map((each) => each.sql)).toEqual(["UPDATE todos SET completed = 1", "SELECT id FROM todos"]);
  });

  it("classifies a D1 error, named by the context", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const read = await writeThenQueryAll(
      db,
      () => db.prepare("UPDATE todos SET completed = 1"),
      () => db.prepare("SELECT id FROM todos"),
      "set all",
    );

    expect(read).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "set all: D1_ERROR: Network connection lost." },
    });
  });

  it("classifies an error thrown while binding, as it builds the statements inside the try", async () => {
    const { db, batches } = fakeD1({ throwsOnBind: new Error("D1_TYPE_ERROR: Type 'undefined' not supported") });

    const read = await writeThenQueryAll(
      db,
      () => db.prepare("UPDATE todos SET completed = ?1").bind(undefined),
      () => db.prepare("SELECT id FROM todos"),
      "set all",
    );

    expect(read).toMatchObject({ ok: false, error: { kind: "server" } });
    expect(batches).toEqual([]);
  });
});

describe("executeBatch", () => {
  it("runs the writes as one batch, and returns each one's changes in order", async () => {
    const { db, batches } = fakeD1({ changes: 1 });

    const written = await executeBatch(
      db,
      () => [db.prepare("UPDATE sessions SET ended_at = 1"), db.prepare("UPDATE credentials SET secret = 'x'")],
      "sign in",
    );

    expect(written).toEqual({ ok: true, value: [1, 1] });
    expect(batches).toEqual([2]);
  });

  it("classifies a D1 error, named by the context", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    const written = await executeBatch(db, () => [db.prepare("UPDATE sessions SET ended_at = 1")], "sign in");

    expect(written).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "sign in: D1_ERROR: Network connection lost." },
    });
  });

  it("classifies an error thrown while binding, as it builds the statements inside the try", async () => {
    const { db, batches } = fakeD1({ throwsOnBind: new Error("D1_TYPE_ERROR: Type 'undefined' not supported") });

    const written = await executeBatch(db, () => [db.prepare("UPDATE sessions SET ended_at = ?1").bind(undefined)], "sign in");

    expect(written).toMatchObject({ ok: false, error: { kind: "server" } });
    expect(batches).toEqual([]);
  });
});
