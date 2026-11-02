import { describe, expect, it } from "vitest";
import { execute, queryAll } from "../../src/driver.ts";
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
