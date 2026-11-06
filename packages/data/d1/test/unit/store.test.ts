import { expect, it } from "vitest";
import { createIdentityStore } from "../../src/identity/store.ts";
import { createDbStore } from "../../src/store.ts";
import { fakeD1 } from "./fake-d1.ts";

// A name two tables share would silently replace a method, so this lists
// every method the store has. Adding a table means adding its names here.
it("holds every table's methods, flat", () => {
  const { db } = fakeD1();

  const names = Object.keys(createDbStore(db)).sort();

  expect(names).toEqual([
    "addTodoUnlessFull",
    "countTodos",
    "deleteCompleted",
    "deleteTodo",
    "listTodos",
    "setAllCompleted",
    "updateTodo",
  ]);
});

it("prepares nothing when it is built", () => {
  const { db, prepared } = fakeD1();

  createDbStore(db);

  expect(prepared).toEqual([]);
});

it("holds every identity table's methods, flat", () => {
  const { db } = fakeD1();

  const names = Object.keys(createIdentityStore(db)).sort();

  expect(names).toEqual([
    "createUser",
    "endAllSessions",
    "endSession",
    "findForSignIn",
    "findSession",
    "findUserByEmail",
    "listSessions",
    "markVerified",
    "recordSignIn",
    "setCredential",
    "touchSession",
  ]);
});

it("prepares nothing when the identity store is built", () => {
  const { db, prepared } = fakeD1();

  createIdentityStore(db);

  expect(prepared).toEqual([]);
});
