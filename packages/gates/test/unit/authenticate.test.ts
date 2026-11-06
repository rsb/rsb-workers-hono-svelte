import { SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, unavailable } from "@todo/fail/fail.ts";
import { describe, expect, test } from "vitest";
import { type SessionLookup, type SessionRow, authenticate } from "../../src/authenticate.ts";

const NOW = Date.UTC(2026, 10, 5, 12);
const HOUR = 60 * 60 * 1000;
const TOKEN = "a".repeat(43);
const OTHER = "b".repeat(43);

/** A digest that is plainly not SHA-256, so a test can see which hash was looked up. */
const digest = async (token: string) => `hash:${token}`;

const row = (overrides: { session?: Partial<SessionRow["session"]>; user?: Partial<SessionRow["user"]> } = {}): SessionRow => ({
  session: {
    id: "s1",
    userId: "u1",
    channel: "cookie",
    idleUntil: NOW + 20 * HOUR,
    expiresAt: NOW + 10 * 24 * HOUR,
    endedAt: null,
    ...overrides.session,
  },
  user: { role: "member", disabled: false, emailVerifiedAt: null, name: "Ada Lovelace", email: "ada@example.com", ...overrides.user },
});

/** A lookup that knows one token's session, and records each hash it is asked for. */
const lookup = (known: SessionRow | null, token = TOKEN) => {
  const asked: string[] = [];
  const sessions: SessionLookup = {
    findSession: async (hash): Promise<Result<SessionRow | null, AnyFail>> => {
      asked.push(hash);
      return ok(hash === `hash:${token}` ? known : null);
    },
  };
  return { sessions, asked };
};

const run = (sessions: SessionLookup, cookie?: string, bearer?: string) =>
  authenticate({ sessions, digest })({ credentials: { cookie, bearer }, now: NOW });

const anonymousWith = (clearCookie: boolean) => ok({ actor: { kind: "anonymous" }, profile: undefined, clearCookie, refreshDue: undefined });

describe("no credential", () => {
  test("is anonymous, clears nothing and reads nothing", async () => {
    const { sessions, asked } = lookup(row());
    expect(await run(sessions)).toEqual(anonymousWith(false));
    expect(asked).toEqual([]);
  });
});

describe("a cookie", () => {
  test("naming a live session is its user, with the profile", async () => {
    const { sessions, asked } = lookup(row({ user: { emailVerifiedAt: NOW - HOUR } }));
    expect(await run(sessions, TOKEN)).toEqual(
      ok({
        actor: { kind: "user", userId: "u1", role: "member", emailVerified: true },
        profile: { name: "Ada Lovelace", email: "ada@example.com" },
        clearCookie: false,
        refreshDue: undefined,
      }),
    );
    // The store is asked for the hash, never the raw token.
    expect(asked).toEqual([`hash:${TOKEN}`]);
  });

  test("of an admin carries the role", async () => {
    const { sessions } = lookup(row({ user: { role: "admin" } }));
    const result = await run(sessions, TOKEN);
    expect(result.ok && result.value.actor).toEqual({ kind: "user", userId: "u1", role: "admin", emailVerified: false });
  });

  test.each([
    ["is not a token", "not-a-token", row()],
    ["names no session", OTHER, row()],
    ["names an ended session", TOKEN, row({ session: { endedAt: NOW - HOUR } })],
    ["names a session past its idle window", TOKEN, row({ session: { idleUntil: NOW } })],
    ["names a session past its absolute expiry", TOKEN, row({ session: { expiresAt: NOW } })],
    ["names a bearer session", TOKEN, row({ session: { channel: "bearer", idleUntil: null } })],
  ])("that %s is anonymous and is cleared", async (_, cookie, known) => {
    const { sessions } = lookup(known);
    expect(await run(sessions, cookie)).toEqual(anonymousWith(true));
  });

  test("whose user is disabled is refused, account_disabled", async () => {
    const { sessions } = lookup(row({ user: { disabled: true } }));
    expect(await run(sessions, TOKEN)).toEqual(err({ kind: "account_disabled", message: "the account is disabled" }));
  });
});

describe("a bearer token", () => {
  const bearerRow = (session: Partial<SessionRow["session"]> = {}) =>
    row({ session: { channel: "bearer", idleUntil: null, ...session } });

  test("naming a live session is its user, and has no idle window to refresh", async () => {
    const { sessions } = lookup(bearerRow());
    const result = await run(sessions, undefined, TOKEN);
    expect(result.ok && result.value.actor).toEqual({ kind: "user", userId: "u1", role: "member", emailVerified: false });
    expect(result.ok && result.value.refreshDue).toBeUndefined();
  });

  test.each([
    ["is not a token", "not-a-token", bearerRow()],
    ["names no session", OTHER, bearerRow()],
    ["names an ended session", TOKEN, bearerRow({ endedAt: NOW - HOUR })],
    ["names an expired session", TOKEN, bearerRow({ expiresAt: NOW })],
    ["names a cookie session", TOKEN, row()],
  ])("that %s is refused, unauthenticated", async (_, bearer, known) => {
    const { sessions } = lookup(known);
    const result = await run(sessions, undefined, bearer);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("unauthenticated");
  });
});

test("a cookie and a bearer token together are refused, unauthenticated, and read nothing", async () => {
  const { sessions, asked } = lookup(row());
  const result = await run(sessions, TOKEN, TOKEN);
  expect(!result.ok && result.error.kind).toBe("unauthenticated");
  expect(asked).toEqual([]);
});

test("a store that fails is the store's failure, wrapped", async () => {
  const sessions: SessionLookup = { findSession: async () => err(unavailable("d1 is down")) };
  const result = await run(sessions, TOKEN);
  expect(!result.ok && result.error).toMatchObject({ kind: "unavailable", message: "authenticate: d1 is down" });
});

describe("refreshDue", () => {
  test("is unset while more than half the idle window is left", async () => {
    const { sessions } = lookup(row({ session: { idleUntil: NOW + SESSION_IDLE_MS / 2 + 1 } }));
    const result = await run(sessions, TOKEN);
    expect(result.ok && result.value.refreshDue).toBeUndefined();
  });

  test("moves the window a full idle period on, once less than half is left", async () => {
    const { sessions } = lookup(row({ session: { idleUntil: NOW + SESSION_IDLE_MS / 2 - 1 } }));
    const result = await run(sessions, TOKEN);
    expect(result.ok && result.value.refreshDue).toEqual({ sessionId: "s1", idleUntil: NOW + SESSION_IDLE_MS });
  });

  test("never moves the window past the absolute expiry", async () => {
    const { sessions } = lookup(row({ session: { idleUntil: NOW + HOUR, expiresAt: NOW + 2 * HOUR } }));
    const result = await run(sessions, TOKEN);
    expect(result.ok && result.value.refreshDue).toEqual({ sessionId: "s1", idleUntil: NOW + 2 * HOUR });
  });

  test("is unset when the window already reaches the absolute expiry", async () => {
    const { sessions } = lookup(row({ session: { idleUntil: NOW + HOUR, expiresAt: NOW + HOUR } }));
    const result = await run(sessions, TOKEN);
    expect(result.ok && result.value.refreshDue).toBeUndefined();
  });
});
