import type { SignInCredential } from "@todo/business/auth/credential.ts";
import type { EndpointKey } from "@todo/contract-api";
import { describe, expect, it } from "vitest";
import { countingStore, fakeDbStore } from "./fake-db-store.ts";
import { fakeHasher } from "./fake-hasher.ts";
import { fakeIdentityStore } from "./fake-identity-store.ts";
import { MEMBER_TOKEN, sessionRows } from "./gates/session-rows.ts";
import { MEMBER } from "./signed-in.ts";
import { config, testApi } from "./test-api.ts";

/**
 * Who sends a budget's request: the member, by their bearer session, or the
 * BFF's sign-in page, with no session and the headers a same-origin page
 * sends, which the `channel` gate asks of a change without a bearer token.
 */
type Sender = "member" | "page";

/** An endpoint's budget, and the one request that spends it. */
type Budget = { storeCalls: number; identityCalls: number; path: string; init?: RequestInit; from?: Sender };

/** Ada's account in the fake identity store: the fake hasher's hash of `PASSWORD`. */
const PASSWORD = "correct horse battery staple";
const ada: SignInCredential = {
  user: { id: "u1", role: "member", disabled: false, emailVerifiedAt: null },
  credential: { secret: `fake:${PASSWORD}`, pepperId: 1 },
};
const SIGN_IN = { method: "POST", body: JSON.stringify({ email: "ada@example.com", password: PASSWORD }) };

/**
 * Every endpoint's budget of store calls, from the handler down through the
 * operation's port (L11, L36): `storeCalls` on the `DbStore`, and
 * `identityCalls` on the `IdentityStore`, the `authenticate` gate's lookup
 * included. The current cost written down, not a limit to stay under. An
 * endpoint without one does not compile. A change to a number goes in the
 * commit that changes the cost, with its reason. A bearer session has no
 * idle window, so no touch is ever due here.
 */
const budgets: Record<EndpointKey, Budget> = {
  "GET /health": { storeCalls: 0, identityCalls: 1, path: "/health" },
  // What the gate attached is the reply: the identity round trip is the gate's.
  "GET /sessions/current": { storeCalls: 0, identityCalls: 1, path: "/sessions/current" },
  // The join read, then the one batch (L48, L49); no session presented, so
  // no gate lookup. The hash's CPU is one Argon2id check, counted below.
  "POST /sessions": { storeCalls: 0, identityCalls: 2, path: "/sessions", init: SIGN_IN, from: "page" },
  // The gate's lookup, then one read of at most SESSIONS_LIST_MAX rows (L51).
  "GET /sessions": { storeCalls: 0, identityCalls: 2, path: "/sessions" },
  // The gate's lookup, then one statement over the owner's live rows (L50).
  "DELETE /sessions": { storeCalls: 0, identityCalls: 2, path: "/sessions", init: { method: "DELETE" } },
  // The gate's lookup, then one write (L50).
  "DELETE /sessions/current": { storeCalls: 0, identityCalls: 2, path: "/sessions/current", init: { method: "DELETE" } },
  "GET /todos": { storeCalls: 1, identityCalls: 1, path: "/todos?completed=true" },
  "GET /todos/counts": { storeCalls: 1, identityCalls: 1, path: "/todos/counts" },
  "POST /todos": { storeCalls: 1, identityCalls: 1, path: "/todos", init: { method: "POST", body: '{"title":"walk dog"}' } },
  "PATCH /todos": { storeCalls: 1, identityCalls: 1, path: "/todos", init: { method: "PATCH", body: '{"completed":true}' } },
  "PATCH /todos/{id}": { storeCalls: 1, identityCalls: 1, path: "/todos/id-1", init: { method: "PATCH", body: '{"completed":false}' } },
  "DELETE /todos": { storeCalls: 1, identityCalls: 1, path: "/todos?completed=true", init: { method: "DELETE" } },
  "DELETE /todos/{id}": { storeCalls: 1, identityCalls: 1, path: "/todos/id-1", init: { method: "DELETE" } },
};

/** The headers a budget's sender adds. */
const headersOf = (from: Sender): Record<string, string> =>
  from === "member"
    ? { Authorization: `Bearer ${MEMBER}` }
    : { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" };

describe("each endpoint spends its budget of store calls", () => {
  it.each(Object.entries(budgets))("%s", async (endpoint, { storeCalls, identityCalls, path, init = {}, from = "member" }) => {
    // One completed todo of the member's, seeded past the counter, so every
    // request, sent as the member, succeeds.
    const fake = fakeDbStore();
    await fake.addTodoUnlessFull({ ownerId: "u1" }, { id: "id-1", title: "buy milk", completed: true }, 500);
    const db = countingStore(fake);
    const identity = countingStore(fakeIdentityStore(sessionRows, { "ada@example.com": ada }).store);
    // The real gates and route table: handler, validator and operation all run (Q3).
    const api = testApi({ dbStore: db.store, identityStore: identity.store, newId: () => "id-2" });

    const response = await api.request(path, { ...init, headers: headersOf(from) });

    // A refused request can stop short of its cost, so only a success counts.
    expect(response.ok, `${endpoint} answered ${response.status}, so its cost was not measured`).toBe(true);
    const spent = (store: string, budget: number, calls: string[]) =>
      `${endpoint}: budget ${budget} ${store} calls, spent ${calls.length} (${calls.join(", ")})`;
    expect(db.calls.length, spent("DbStore", storeCalls, db.calls)).toBe(storeCalls);
    expect(identity.calls.length, spent("IdentityStore", identityCalls, identity.calls)).toBe(identityCalls);
  });
});

describe("sign-in's budget beyond the table", () => {
  it("adds the gate's lookup when the page presents a live session, and still writes one batch", async () => {
    const identity = countingStore(fakeIdentityStore(sessionRows, { "ada@example.com": ada }).store);
    const api = testApi({ identityStore: identity.store });

    const response = await api.request("/sessions", {
      ...SIGN_IN,
      headers: { ...headersOf("page"), Cookie: `${config.sessionCookie}=${MEMBER_TOKEN}` },
    });

    expect(response.status).toBe(201);
    expect(identity.calls).toEqual(["findSession", "findForSignIn", "recordSignIn"]);
  });

  it("checks one hash, with the right password or a wrong one, and with an email no account has", async () => {
    for (const body of [
      { email: "ada@example.com", password: PASSWORD },
      { email: "ada@example.com", password: "wrong" },
      { email: "nobody@example.com", password: PASSWORD },
    ]) {
      const hasher = fakeHasher();
      const api = testApi({ identityStore: fakeIdentityStore({}, { "ada@example.com": ada }).store, hasher: hasher.hasher });

      await api.request("/sessions", { method: "POST", body: JSON.stringify(body), headers: headersOf("page") });

      expect(hasher.verified, body.email).toHaveLength(1);
    }
  });
});
