import { SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { err } from "@todo/business/result.ts";
import { Failure } from "@todo/contract-api";
import { unavailable } from "@todo/fail/fail.ts";
import { type ExecutionContext, Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { type Infra, constructGates } from "../../../src/construct.ts";
import { fakeDbStore } from "../fake-db-store.ts";
import { fakeHasher } from "../fake-hasher.ts";
import { fakeIdentityStore } from "../fake-identity-store.ts";
import { NOW, config, digest, testApi } from "../test-api.ts";
import { BEARER_TOKEN, DISABLED_TOKEN, MEMBER_TOKEN, STALE_TOKEN, UNKNOWN_TOKEN, sessionRows } from "./session-rows.ts";

// The `authenticate` gate's binding (L39): what it reads, what it attaches,
// what it refuses, and the touch it leaves for after the response. The
// unit's every branch is tested in `packages/gates`.

/** What `waitUntil` was handed, so a test can wait for the touch. */
const executionContext = () => {
  const waited: Promise<unknown>[] = [];
  const ctx: ExecutionContext = {
    waitUntil: (promise) => {
      waited.push(promise);
    },
    passThroughOnException: () => {},
    props: {},
  };
  return { ctx, waited };
};

/**
 * The gates alone, before one route that answers what they attached. No
 * route reads the actor until `GET /sessions/current`, so this one stands
 * in for it.
 */
const whoami = (identity = fakeIdentityStore(sessionRows)) => {
  const infra: Infra = { dbStore: fakeDbStore(), identityStore: identity.store, newId: () => "id-1", now: () => NOW, digest, hasher: fakeHasher().hasher };
  const app = new Hono();
  for (const gate of constructGates(infra, config)) {
    app.use(gate);
  }
  app.get("/whoami", (c) =>
    c.json({ channel: c.get("channel"), actor: c.get("actor"), profile: c.get("profile") ?? null, clearCookie: c.get("clearCookie") }),
  );
  return { app, identity };
};

const cookie = (token: string) => ({ Cookie: `${config.sessionCookie}=${token}` });
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("what the gate attaches", () => {
  it("is anonymous for no credential, and reads nothing", async () => {
    const { app, identity } = whoami();
    const response = await app.request("/whoami");
    expect(await response.json()).toEqual({ channel: "none", actor: { kind: "anonymous" }, profile: null, clearCookie: false });
    expect(identity.asked).toEqual([]);
  });

  it("is the member and their profile for a live cookie session, looked up by its hash", async () => {
    const { app, identity } = whoami();
    const response = await app.request("/whoami", { headers: cookie(MEMBER_TOKEN) });
    expect(await response.json()).toEqual({
      channel: "cookie",
      actor: { kind: "user", userId: "u1", role: "member", emailVerified: false },
      profile: { name: "Ada Lovelace", email: "ada@example.com" },
      clearCookie: false,
    });
    expect(identity.asked).toEqual([`hash:${MEMBER_TOKEN}`]);
  });

  it("is the member for a live bearer session", async () => {
    const { app } = whoami();
    const response = await app.request("/whoami", { headers: bearer(BEARER_TOKEN) });
    expect(await response.json()).toMatchObject({ channel: "bearer", actor: { kind: "user", userId: "u1" } });
  });

  it("is anonymous, with the cookie to clear, for a cookie that names no session", async () => {
    const { app } = whoami();
    const response = await app.request("/whoami", { headers: cookie(UNKNOWN_TOKEN) });
    expect(await response.json()).toEqual({ channel: "cookie", actor: { kind: "anonymous" }, profile: null, clearCookie: true });
  });
});

describe("what the gate refuses", () => {
  const refused = async (response: Response) => ({ status: response.status, error: v.parse(Failure, await response.json()).error });

  it("a bearer token that names no session, as unauthenticated", async () => {
    const response = await testApi({ identityStore: fakeIdentityStore(sessionRows).store }).request("/todos", {
      headers: bearer(UNKNOWN_TOKEN),
    });
    expect(await refused(response)).toEqual({
      status: 401,
      error: { kind: "unauthenticated", message: "the bearer token names no live session" },
    });
  });

  it("an Authorization that is not a bearer token, as unauthenticated", async () => {
    const response = await testApi().request("/todos", { headers: { Authorization: "Basic YWRhOnNlY3JldA==" } });
    expect(await refused(response)).toEqual({
      status: 401,
      error: { kind: "unauthenticated", message: "the bearer token is not a token" },
    });
  });

  it("a cookie and a bearer token together, as unauthenticated", async () => {
    const response = await testApi({ identityStore: fakeIdentityStore(sessionRows).store }).request("/todos", {
      headers: { ...cookie(MEMBER_TOKEN), ...bearer(BEARER_TOKEN) },
    });
    expect(await refused(response)).toEqual({
      status: 401,
      error: { kind: "unauthenticated", message: "a request gives a cookie or a bearer token, not both" },
    });
  });

  it("a disabled user's live session, as forbidden with the reason account_disabled", async () => {
    const response = await testApi({ identityStore: fakeIdentityStore(sessionRows).store }).request("/todos", {
      headers: cookie(DISABLED_TOKEN),
    });
    expect(await refused(response)).toEqual({
      status: 403,
      error: { kind: "forbidden", reason: "account_disabled", message: "the account is disabled" },
    });
  });

  it("nothing, when the store fails: internal, with the cause in the log only", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: string) => {
      lines.push(line);
    });
    const failing = fakeIdentityStore().store;
    failing.findSession = async () => err(unavailable("D1 is down", new Error("D1_ERROR: network lost")));

    const response = await testApi({ identityStore: failing }).request("/todos", { headers: cookie(MEMBER_TOKEN) });

    expect(await refused(response)).toEqual({ status: 500, error: { kind: "internal", message: "internal error" } });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ kind: "unavailable", message: "authenticate: D1 is down" });
  });
});

describe("the touch", () => {
  it("moves a stale cookie session's idle window after the response", async () => {
    const { app, identity } = whoami();
    const { ctx, waited } = executionContext();

    const response = await app.request("/whoami", { headers: cookie(STALE_TOKEN) }, undefined, ctx);

    expect(response.status).toBe(200);
    await Promise.all(waited);
    expect(identity.touched).toEqual([{ id: "s-stale", idleUntil: NOW + SESSION_IDLE_MS, now: NOW }]);
  });

  it("is not due for a session with more than half its idle window left", async () => {
    const { app, identity } = whoami();
    const { ctx, waited } = executionContext();

    await app.request("/whoami", { headers: cookie(MEMBER_TOKEN) }, undefined, ctx);

    expect(waited).toEqual([]);
    expect(identity.touched).toEqual([]);
  });

  it("is logged, never answered, when it fails", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: string) => {
      lines.push(line);
    });
    const identity = fakeIdentityStore(sessionRows);
    identity.store.touchSession = async () => err(unavailable("D1 is down"));
    const { app } = whoami(identity);
    const { ctx, waited } = executionContext();

    const response = await app.request("/whoami", { headers: cookie(STALE_TOKEN) }, undefined, ctx);
    await Promise.all(waited);

    expect(response.status).toBe(200);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ kind: "unavailable", message: "touch session: D1 is down" });
  });
});
