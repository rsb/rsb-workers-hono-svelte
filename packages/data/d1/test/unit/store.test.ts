import { expect, it } from "vitest";
import { createDbStore } from "../../src/store.ts";
import { fakeD1 } from "./fake-d1.ts";

// A name two tables share would silently replace a method, so this lists
// every method the store has. Adding a table means adding its names here.
it("holds every table's methods, flat", () => {
  const { db } = fakeD1();

  const names = Object.keys(createDbStore(db)).sort();

  expect(names).toEqual(["addTodoUnlessFull", "listTodos", "updateTodo"]);
});

it("prepares nothing when it is built", () => {
  const { db, prepared } = fakeD1();

  createDbStore(db);

  expect(prepared).toEqual([]);
});
