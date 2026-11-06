import type { EndpointKey } from "@todo/contract-api";
import { describe, expect, it } from "vitest";
import { countingDbStore, fakeDbStore } from "./fake-db-store.ts";
import { MEMBER, signedIn } from "./signed-in.ts";

/** An endpoint's budget, and the one request that spends it. */
type Budget = { storeCalls: number; path: string; init?: RequestInit };

/**
 * Every endpoint's budget of `DbStore` calls, from the handler down through
 * the operation's port (L11, L36): the current cost written down, not a
 * limit to stay under. An endpoint without one does not compile. A change
 * to a number goes in the commit that changes the cost, with its reason.
 */
const budgets: Record<EndpointKey, Budget> = {
  "GET /health": { storeCalls: 0, path: "/health" },
  // What the gate attached is the reply: the identity round trip is the gate's.
  "GET /sessions/current": { storeCalls: 0, path: "/sessions/current" },
  "GET /todos": { storeCalls: 1, path: "/todos?completed=true" },
  "GET /todos/counts": { storeCalls: 1, path: "/todos/counts" },
  "POST /todos": { storeCalls: 1, path: "/todos", init: { method: "POST", body: '{"title":"walk dog"}' } },
  "PATCH /todos": { storeCalls: 1, path: "/todos", init: { method: "PATCH", body: '{"completed":true}' } },
  "PATCH /todos/{id}": { storeCalls: 1, path: "/todos/id-1", init: { method: "PATCH", body: '{"completed":false}' } },
  "DELETE /todos": { storeCalls: 1, path: "/todos?completed=true", init: { method: "DELETE" } },
  "DELETE /todos/{id}": { storeCalls: 1, path: "/todos/id-1", init: { method: "DELETE" } },
};

describe("each endpoint spends its budget of DbStore calls", () => {
  it.each(Object.entries(budgets))("%s", async (endpoint, { storeCalls, path, init }) => {
    // One completed todo of the member's, seeded past the counter, so every
    // request, sent as the member, succeeds.
    const fake = fakeDbStore();
    await fake.addTodoUnlessFull({ ownerId: "u1" }, { id: "id-1", title: "buy milk", completed: true }, 500);
    const { store, calls } = countingDbStore(fake);
    // The real gates and route table: handler, validator and operation all run (Q3).
    const api = signedIn(MEMBER, { dbStore: store, newId: () => "id-2" });

    const response = await api.request(path, init);

    // A refused request can stop short of its cost, so only a success counts.
    expect(response.ok, `${endpoint} answered ${response.status}, so its cost was not measured`).toBe(true);
    const words = `${endpoint}: budget ${storeCalls} store calls, spent ${calls.length} (${calls.join(", ")})`;
    expect(calls.length, words).toBe(storeCalls);
  });
});
