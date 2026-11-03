import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { AddTodoBody, DeletedReply, PatchTodoBody } from "../../src/index.ts";

/** The issue a body fails with: its first path key and its message. */
const issue = (body: unknown, schema: v.GenericSchema = AddTodoBody) => {
  const result = v.safeParse(schema, body);
  if (result.success) {
    return undefined;
  }
  const [first] = result.issues;
  return { field: first.path?.[0]?.key, message: first.message };
};

// Only the shape is the contract's. The title's rules are tested with each handler.
describe("AddTodoBody", () => {
  it("rejects a title that is not text", () => {
    expect(issue({ title: 3 })).toEqual({ field: "title", message: "title must be text" });
  });

  it("rejects an unknown key", () => {
    expect(issue({ title: "buy milk", done: true })?.field).toBe("done");
  });

  it("passes the title through as sent, untrimmed", () => {
    expect(v.parse(AddTodoBody, { title: "  buy milk  " })).toEqual({ title: "  buy milk  " });
  });
});

describe("PatchTodoBody", () => {
  it("rejects completed that is not a boolean", () => {
    expect(issue({ completed: "true" }, PatchTodoBody)).toEqual({
      field: "completed",
      message: "completed must be true or false",
    });
  });

  it("rejects a title that is not text", () => {
    expect(issue({ title: 1 }, PatchTodoBody)).toEqual({
      field: "title",
      message: "title must be text",
    });
  });

  it("rejects a body with neither title nor completed", () => {
    expect(issue({}, PatchTodoBody)).toEqual({
      field: undefined,
      message: "body must have title, completed or both",
    });
  });

  it("rejects an unknown key", () => {
    expect(issue({ completed: true, order: 1 }, PatchTodoBody)?.field).toBe("order");
  });

  it("passes completed alone through", () => {
    expect(v.parse(PatchTodoBody, { completed: false })).toEqual({ completed: false });
  });

  it("passes title alone through, untrimmed", () => {
    expect(v.parse(PatchTodoBody, { title: " buy milk " })).toEqual({ title: " buy milk " });
  });

  it("passes both through", () => {
    expect(v.parse(PatchTodoBody, { title: "buy milk", completed: true })).toEqual({
      title: "buy milk",
      completed: true,
    });
  });
});

describe("DeletedReply", () => {
  it("reads the id of the todo deleted", () => {
    expect(v.parse(DeletedReply, { id: "id-1" })).toEqual({ id: "id-1" });
  });

  it("rejects anything more than the id", () => {
    expect(issue({ id: "id-1", title: "buy milk" }, DeletedReply)?.field).toBe("title");
  });
});
