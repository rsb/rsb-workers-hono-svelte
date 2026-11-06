import { DeletedReply, Failure, TodoCountsReply, TodoListReply, TodoReply, envelope } from "@todo/contract-api";
import * as v from "valibot";
import { expect, it } from "vitest";
import { fakeDbStore } from "./fake-db-store.ts";
import { ADMIN, MEMBER, signedIn } from "./signed-in.ts";
import { testApi } from "./test-api.ts";

// The whole api on fake stores, entered below `constructInfra` (A10): no
// workerd, no database, and a fixed id so the reply is exact. Every
// request is the member's, by their bearer session, unless it says.
const app = (newId = () => "id-1") => signedIn(MEMBER, { newId });

it("an added todo is in the next list", async () => {
  const api = app();

  const added = await api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  expect(added.status).toBe(201);
  expect(v.parse(envelope(TodoReply), await added.json())).toEqual({
    ok: true,
    data: { id: "id-1", title: "buy milk", completed: false },
  });

  const listed = await api.request("/todos");
  expect(v.parse(envelope(TodoListReply), await listed.json())).toEqual({
    ok: true,
    data: [{ id: "id-1", title: "buy milk", completed: false }],
  });
});

it("an add after the limit is refused with limit", async () => {
  let n = 0;
  const api = app(() => `id-${++n}`);
  const add = () => api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  // The PRD's limit, written out: business constants stay out of apps/ (L27).
  const limit = 500;
  for (let i = 1; i <= limit; i++) {
    expect((await add()).status).toBe(201);
  }

  const refused = await add();

  expect(refused.status).toBe(409);
  expect(v.parse(Failure, await refused.json()).error.kind).toBe("limit");
});

it("a toggled todo is completed in the next list, and can be made active again", async () => {
  const api = app();
  await api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  const toggle = (completed: boolean) =>
    api.request("/todos/id-1", { method: "PATCH", body: JSON.stringify({ completed }) });

  const completed = await toggle(true);
  expect(completed.status).toBe(200);
  expect(v.parse(envelope(TodoReply), await completed.json())).toEqual({
    ok: true,
    data: { id: "id-1", title: "buy milk", completed: true },
  });
  const listed = await api.request("/todos");
  expect(v.parse(envelope(TodoListReply), await listed.json())).toEqual({
    ok: true,
    data: [{ id: "id-1", title: "buy milk", completed: true }],
  });

  const active = await toggle(false);
  expect(v.parse(envelope(TodoReply), await active.json())).toMatchObject({ data: { completed: false } });
});

it("a toggle of an id no todo has is refused with not_found", async () => {
  const api = app();

  const refused = await api.request("/todos/id-9", { method: "PATCH", body: '{"completed":true}' });

  expect(refused.status).toBe(404);
  expect(v.parse(Failure, await refused.json()).error.kind).toBe("not_found");
});

it("mark all completes every todo, then makes every todo active again", async () => {
  let n = 0;
  const api = app(() => `id-${++n}`);
  await api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  await api.request("/todos", { method: "POST", body: '{"title":"walk dog"}' });
  const markAll = (completed: boolean) =>
    api.request("/todos", { method: "PATCH", body: JSON.stringify({ completed }) });

  const done = await markAll(true);
  expect(done.status).toBe(200);
  expect(v.parse(envelope(TodoListReply), await done.json())).toEqual({
    ok: true,
    data: [
      { id: "id-1", title: "buy milk", completed: true },
      { id: "id-2", title: "walk dog", completed: true },
    ],
  });

  const active = await markAll(false);
  const reply = v.parse(envelope(TodoListReply), await active.json());
  expect(reply.ok && reply.data.map((todo) => todo.completed)).toEqual([false, false]);
});

it("a deleted todo is not in the next list, and a second delete is refused with not_found", async () => {
  const api = app();
  await api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  const remove = () => api.request("/todos/id-1", { method: "DELETE" });

  const deleted = await remove();
  expect(deleted.status).toBe(200);
  expect(v.parse(envelope(DeletedReply), await deleted.json())).toEqual({ ok: true, data: { id: "id-1" } });
  const listed = await api.request("/todos");
  expect(v.parse(envelope(TodoListReply), await listed.json())).toEqual({ ok: true, data: [] });

  const again = await remove();
  expect(again.status).toBe(404);
  expect(v.parse(Failure, await again.json()).error.kind).toBe("not_found");
});

it("a clear leaves only the active todos, and the route with no query is refused, not a delete of all", async () => {
  let n = 0;
  const api = app(() => `id-${++n}`);
  await api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  await api.request("/todos", { method: "POST", body: '{"title":"walk dog"}' });
  await api.request("/todos/id-1", { method: "PATCH", body: '{"completed":true}' });

  const refused = await api.request("/todos", { method: "DELETE" });
  expect(refused.status).toBe(422);
  const kept = v.parse(envelope(TodoListReply), await (await api.request("/todos")).json());
  expect(kept.ok && kept.data.length).toBe(2);

  const cleared = await api.request("/todos?completed=true", { method: "DELETE" });
  expect(cleared.status).toBe(200);
  expect(v.parse(envelope(TodoListReply), await cleared.json())).toEqual({
    ok: true,
    data: [{ id: "id-2", title: "walk dog", completed: false }],
  });
});

it("a filtered list keeps only the todos asked for, and the counts cover every todo", async () => {
  let n = 0;
  const api = app(() => `id-${++n}`);
  await api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  await api.request("/todos", { method: "POST", body: '{"title":"walk dog"}' });
  await api.request("/todos/id-1", { method: "PATCH", body: '{"completed":true}' });
  const list = async (query: string) => {
    const response = await api.request(`/todos${query}`);
    const reply = v.parse(envelope(TodoListReply), await response.json());
    return reply.ok && reply.data.map((todo) => todo.title);
  };

  expect(await list("?completed=true")).toEqual(["buy milk"]);
  expect(await list("?completed=false")).toEqual(["walk dog"]);
  expect(await list("")).toEqual(["buy milk", "walk dog"]);
  const refused = await api.request("/todos?completed=yes");
  expect(refused.status).toBe(422);

  // Routed before `/todos/:id`, so `counts` is not read as an id.
  const counted = await api.request("/todos/counts");
  expect(counted.status).toBe(200);
  expect(v.parse(envelope(TodoCountsReply), await counted.json())).toEqual({
    ok: true,
    data: { active: 1, completed: 1 },
  });
});

it("every todo endpoint refuses an anonymous request as unauthenticated, and stores nothing", async () => {
  const dbStore = fakeDbStore();
  const anonymous = testApi({ dbStore });
  const requests: [string, RequestInit?][] = [
    ["/todos"],
    ["/todos/counts"],
    ["/todos", { method: "POST", body: '{"title":"buy milk"}' }],
    ["/todos", { method: "PATCH", body: '{"completed":true}' }],
    ["/todos/id-1", { method: "PATCH", body: '{"completed":true}' }],
    ["/todos?completed=true", { method: "DELETE" }],
    ["/todos/id-1", { method: "DELETE" }],
  ];

  for (const [path, init] of requests) {
    const refused = await anonymous.request(path, init);
    expect(refused.status, `${init?.method ?? "GET"} ${path}`).toBe(401);
    expect(v.parse(Failure, await refused.json()).error.kind).toBe("unauthenticated");
  }
  expect(await dbStore.countTodos({ any: true })).toEqual({ ok: true, value: { active: 0, completed: 0 } });
});

it("a member's todo is not in the admin's list, and the admin's change or delete of it is not_found", async () => {
  // One database, two users (A.8): every todo operation is `own`, the admin's included.
  const dbStore = fakeDbStore();
  const member = signedIn(MEMBER, { dbStore, newId: () => "id-1" });
  const admin = signedIn(ADMIN, { dbStore });
  await member.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });

  const listed = await admin.request("/todos");
  expect(v.parse(envelope(TodoListReply), await listed.json())).toEqual({ ok: true, data: [] });
  const counted = await admin.request("/todos/counts");
  expect(v.parse(envelope(TodoCountsReply), await counted.json())).toEqual({ ok: true, data: { active: 0, completed: 0 } });

  // Another's todo is answered as a missing one is (`todo.owned`).
  const changed = await admin.request("/todos/id-1", { method: "PATCH", body: '{"completed":true}' });
  expect(changed.status).toBe(404);
  const removed = await admin.request("/todos/id-1", { method: "DELETE" });
  expect(removed.status).toBe(404);
  await admin.request("/todos", { method: "PATCH", body: '{"completed":true}' });
  await admin.request("/todos?completed=true", { method: "DELETE" });

  const theirs = await member.request("/todos");
  expect(v.parse(envelope(TodoListReply), await theirs.json())).toEqual({
    ok: true,
    data: [{ id: "id-1", title: "buy milk", completed: false }],
  });
});
