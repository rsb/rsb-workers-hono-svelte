import { Failure, TodoCountsReply, TodoListReply, TodoReply, envelope } from "@todo/contract-api";
import * as v from "valibot";
import { expect, it } from "vitest";
import { ADMIN, MEMBER, fetchAs } from "./signed-in.ts";

// Ownership on the real D1 (L43, `todos.scoped`): two users share one
// database, and every todo operation is `own`, the admin's included
// (`access.md`). The SQL's scope is proven here; the unit tests prove only
// what is bound.

const add = async (actor: { token: string }, title: string) => {
  const response = await fetchAs(actor, "https://todo-api/todos", { method: "POST", body: JSON.stringify({ title }) });
  const reply = v.parse(envelope(TodoReply), await response.json());
  if (!reply.ok) {
    throw new Error("the add failed");
  }
  return reply.data;
};

const listOf = async (actor: { token: string }, query = "") => {
  const response = await fetchAs(actor, `https://todo-api/todos${query}`);
  const reply = v.parse(envelope(TodoListReply), await response.json());
  if (!reply.ok) {
    throw new Error("the list failed");
  }
  return reply.data.map((todo) => todo.title);
};

it("todos.scoped: each user lists and counts only their own todos", async () => {
  await add(MEMBER, "member's milk");
  const theirs = await add(ADMIN, "admin's bread");
  await fetchAs(ADMIN, `https://todo-api/todos/${theirs.id}`, { method: "PATCH", body: '{"completed":true}' });

  expect(await listOf(MEMBER)).toEqual(["member's milk"]);
  expect(await listOf(ADMIN)).toEqual(["admin's bread"]);
  expect(await listOf(MEMBER, "?completed=true")).toEqual([]);
  const counted = await fetchAs(MEMBER, "https://todo-api/todos/counts");
  expect(v.parse(envelope(TodoCountsReply), await counted.json())).toEqual({ ok: true, data: { active: 1, completed: 0 } });
});

it("todo.owned: another's todo is not_found to change or remove, and is left as it was", async () => {
  const mine = await add(MEMBER, "keep me");

  const changed = await fetchAs(ADMIN, `https://todo-api/todos/${mine.id}`, { method: "PATCH", body: '{"title":"taken"}' });
  const removed = await fetchAs(ADMIN, `https://todo-api/todos/${mine.id}`, { method: "DELETE" });

  expect(changed.status).toBe(404);
  expect(v.parse(Failure, await changed.json()).error.kind).toBe("not_found");
  expect(removed.status).toBe(404);
  expect(await listOf(MEMBER)).toContain("keep me");
});

it("todos.scoped: mark all and clear completed touch only the actor's todos", async () => {
  const mine = await add(MEMBER, "mine, done");
  await fetchAs(MEMBER, `https://todo-api/todos/${mine.id}`, { method: "PATCH", body: '{"completed":true}' });
  await add(ADMIN, "admin's, active");

  await fetchAs(ADMIN, "https://todo-api/todos", { method: "PATCH", body: '{"completed":false}' });
  expect(await listOf(MEMBER, "?completed=true")).toContain("mine, done");

  await fetchAs(ADMIN, "https://todo-api/todos", { method: "PATCH", body: '{"completed":true}' });
  await fetchAs(ADMIN, "https://todo-api/todos?completed=true", { method: "DELETE" });
  expect(await listOf(MEMBER)).toContain("mine, done");
  expect(await listOf(ADMIN)).toEqual([]);
});
