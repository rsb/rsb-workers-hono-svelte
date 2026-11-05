import { describe, expect, it } from "vitest";
import { type DbStore, createDbStore } from "../../src/store.ts";
import { type Answer, fakeD1 } from "./fake-d1.ts";

/**
 * What one call of a store method may cost (L11, L36): `trips` is the round
 * trips to D1, the cost on a Worker; `statements` is the statements those
 * trips carry, the cost on D1.
 */
type Cost = { trips: number; statements: number };

/** A method's budget, the call that spends it, and how the fake D1 answers that call. */
type Budget = { budget: Cost; answer: Answer; call: (store: DbStore) => Promise<unknown> };

const todo = { id: "id-1", title: "buy milk", completed: false };

/**
 * Every `DbStore` method's budget: the current cost written down, not a
 * limit to stay under. A method without one does not compile. A change to a
 * number goes in the commit that changes the cost, with its reason (L36).
 */
const budgets: Record<keyof DbStore, Budget> = {
  addTodoUnlessFull: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.addTodoUnlessFull(todo, 500),
  },
  listTodos: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [] },
    call: (store) => store.listTodos({ completed: true }),
  },
  countTodos: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [{ active: 1, completed: 1 }] },
    call: (store) => store.countTodos(),
  },
  updateTodo: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [{ id: "id-1", title: "buy milk", completed: 1 }] },
    call: (store) => store.updateTodo("id-1", { completed: true }),
  },
  setAllCompleted: {
    budget: { trips: 1, statements: 2 },
    answer: { rows: [] },
    call: (store) => store.setAllCompleted(true),
  },
  deleteTodo: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.deleteTodo("id-1"),
  },
  deleteCompleted: {
    budget: { trips: 1, statements: 2 },
    answer: { rows: [] },
    call: (store) => store.deleteCompleted(),
  },
};

describe("each DbStore method spends its budget of round trips to D1", () => {
  it.each(Object.entries(budgets))("%s", async (method, { budget, answer, call }) => {
    const { db, trips } = fakeD1(answer);

    const result = await call(createDbStore(db));

    // A failed call can stop short of its cost, so only a success counts.
    expect(result, `${method} failed, so its cost was not measured`).toMatchObject({ ok: true });
    const spent = { trips: trips.length, statements: trips.reduce((sum, each) => sum + each, 0) };
    const words = `${method}: budget ${budget.trips} trips of ${budget.statements} statements, spent ${spent.trips} trips of ${spent.statements} statements`;
    expect(spent, words).toEqual(budget);
  });
});
