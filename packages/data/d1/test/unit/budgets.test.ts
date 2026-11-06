import { describe, expect, it } from "vitest";
import { type IdentityStore, createIdentityStore } from "../../src/identity/store.ts";
import { type DbStore, createDbStore } from "../../src/store.ts";
import { type Answer, fakeD1 } from "./fake-d1.ts";

/**
 * What one call of a store method may cost (L11, L36): `trips` is the round
 * trips to D1, the cost on a Worker; `statements` is the statements those
 * trips carry, the cost on D1.
 */
type Cost = { trips: number; statements: number };

/** A method's budget, the call that spends it, and how the fake D1 answers that call. */
type Budget<Store> = { budget: Cost; answer: Answer; call: (store: Store) => Promise<unknown> };

const todo = { id: "id-1", title: "buy milk", completed: false };

/** One owner's scope: every todo call takes one (L43), and it costs nothing more. */
const own = { ownerId: "u1" };

/**
 * Every `DbStore` method's budget: the current cost written down, not a
 * limit to stay under. A method without one does not compile. A change to a
 * number goes in the commit that changes the cost, with its reason (L36).
 */
const appBudgets: Record<keyof DbStore, Budget<DbStore>> = {
  addTodoUnlessFull: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.addTodoUnlessFull(own, todo, 500),
  },
  listTodos: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [] },
    call: (store) => store.listTodos(own, { completed: true }),
  },
  countTodos: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [{ active: 1, completed: 1 }] },
    call: (store) => store.countTodos(own),
  },
  updateTodo: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [{ id: "id-1", title: "buy milk", completed: 1 }] },
    call: (store) => store.updateTodo(own, "id-1", { completed: true }),
  },
  setAllCompleted: {
    budget: { trips: 1, statements: 2 },
    answer: { rows: [] },
    call: (store) => store.setAllCompleted(own, true),
  },
  deleteTodo: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.deleteTodo(own, "id-1"),
  },
  deleteCompleted: {
    budget: { trips: 1, statements: 2 },
    answer: { rows: [] },
    call: (store) => store.deleteCompleted(own),
  },
};

const NOW = Date.UTC(2026, 10, 5, 12);

const session = {
  id: "s1",
  tokenHash: "hash-1",
  userId: "u1",
  channel: "cookie" as const,
  createdAt: NOW,
  idleUntil: NOW,
  expiresAt: NOW,
  label: null,
  city: null,
};

const rehash = { userId: "u1", secret: "$argon2id$new", pepperId: 1, previousSecret: "$argon2id$old" };

/** The same for every `IdentityStore` method (`data/identity.md`). */
const identityBudgets: Record<keyof IdentityStore, Budget<IdentityStore>> = {
  findSession: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [] },
    call: (store) => store.findSession("hash-1"),
  },
  touchSession: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.touchSession({ id: "s1", idleUntil: NOW, now: NOW }),
  },
  endSession: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.endSession(own, { id: "s1", reason: "signed_out", now: NOW }),
  },
  endAllSessions: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 2 },
    call: (store) => store.endAllSessions(own, { reason: "signed_out_everywhere", now: NOW }),
  },
  listSessions: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [] },
    call: (store) => store.listSessions(own, { now: NOW }),
  },
  // Its first case; the other three are in `signInBudgets`, below.
  recordSignIn: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.recordSignIn({ session }),
  },
  findForSignIn: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [] },
    call: (store) => store.findForSignIn("ada@example.com"),
  },
  setCredential: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.setCredential({ userId: "u1", kind: "password", secret: "$argon2id$x", pepperId: 1, now: NOW }),
  },
  createUser: {
    budget: { trips: 1, statements: 1 },
    answer: { changes: 1 },
    call: (store) => store.createUser({ id: "u1", email: "ada@example.com", name: "Ada", role: "member", createdAt: NOW }),
  },
  findUserByEmail: {
    budget: { trips: 1, statements: 1 },
    answer: { rows: [] },
    call: (store) => store.findUserByEmail("ada@example.com"),
  },
};

/**
 * `identity.sign_in`'s Cost line has four cases, one batch each; the first
 * is `recordSignIn`'s entry above.
 */
const signInBudgets: Record<string, Budget<IdentityStore>> = {
  "with a presented session": {
    budget: { trips: 1, statements: 2 },
    answer: { changes: 1 },
    call: (store) => store.recordSignIn({ session, rotate: "s0" }),
  },
  "with a due rehash": {
    budget: { trips: 1, statements: 2 },
    answer: { changes: 1 },
    call: (store) => store.recordSignIn({ session, rehash }),
  },
  "with both": {
    budget: { trips: 1, statements: 3 },
    answer: { changes: 1 },
    call: (store) => store.recordSignIn({ session, rotate: "s0", rehash }),
  },
};

const spends = async <Store>(build: (db: D1Database) => Store, method: string, entry: Budget<Store>) => {
  const { budget, answer, call } = entry;
  const { db, trips } = fakeD1(answer);

  const result = await call(build(db));

  // A failed call can stop short of its cost, so only a success counts.
  expect(result, `${method} failed, so its cost was not measured`).toMatchObject({ ok: true });
  const spent = { trips: trips.length, statements: trips.reduce((sum, each) => sum + each, 0) };
  const words = `${method}: budget ${budget.trips} trips of ${budget.statements} statements, spent ${spent.trips} trips of ${spent.statements} statements`;
  expect(spent, words).toEqual(budget);
};

describe("each DbStore method spends its budget of round trips to D1", () => {
  it.each(Object.entries(appBudgets))("%s", (method, entry) => spends(createDbStore, method, entry));
});

describe("each IdentityStore method spends its budget of round trips to D1", () => {
  it.each(Object.entries(identityBudgets))("%s", (method, entry) => spends(createIdentityStore, method, entry));
});

describe("recordSignIn spends its budget in each of its cases", () => {
  it.each(Object.entries(signInBudgets))("%s", (method, entry) => spends(createIdentityStore, method, entry));
});
