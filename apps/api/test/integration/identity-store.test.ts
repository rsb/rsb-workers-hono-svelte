import { SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { createIdentityStore } from "@todo/data-d1/identity/store.ts";
import type { NewSession } from "@todo/data-d1/identity/sessions.ts";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

/**
 * The identity store's SQL against a real D1 (`data/identity.md`): the unit
 * tests prove what is bound and how a row is read, never that the SQL and
 * the schema agree. The gates read it on every request with a credential;
 * `gates.test.ts` covers that path. The file shares one database (DB9), so
 * each test uses its own email and token hashes.
 */

const NOW = Date.UTC(2026, 10, 5, 12);
const store = createIdentityStore(env.IDENTITY_DB);

const createUser = async (id: string, email: string) => {
  const created = await store.createUser({ id, email, name: "Ada Lovelace", role: "member", createdAt: NOW });
  expect(created).toEqual({ ok: true, value: true });
};

const cookieSession = (id: string, userId: string, overrides: Partial<NewSession> = {}): NewSession => ({
  id,
  tokenHash: `hash-${id}`,
  userId,
  channel: "cookie",
  createdAt: NOW,
  idleUntil: NOW + SESSION_IDLE_MS,
  expiresAt: NOW + 30 * SESSION_IDLE_MS,
  ...overrides,
});

describe("users", () => {
  it("creates a user once per email, and finds them by it", async () => {
    await createUser("u-create", "create@example.com");

    expect(
      await store.createUser({ id: "u-again", email: "create@example.com", name: "B", role: "admin", createdAt: NOW }),
    ).toEqual({ ok: true, value: false });
    expect(await store.findUserByEmail("create@example.com")).toEqual({
      ok: true,
      value: {
        id: "u-create",
        email: "create@example.com",
        name: "Ada Lovelace",
        role: "member",
        disabled: false,
        emailVerifiedAt: null,
        createdAt: NOW,
      },
    });
  });

  it("finds no user for an unknown email", async () => {
    expect(await store.findUserByEmail("nobody@example.com")).toEqual({ ok: true, value: null });
  });

  it("refuses an email that is not lower-cased, as server", async () => {
    const created = await store.createUser({ id: "u-upper", email: "Upper@example.com", name: "U", role: "member", createdAt: NOW });
    expect(created).toMatchObject({ ok: false, error: { kind: "server" } });
  });
});

describe("sessions", () => {
  it("starts a session once per token hash, and finds it with its user", async () => {
    await createUser("u-start", "start@example.com");
    const session = cookieSession("s-start", "u-start");

    expect(await store.startSession(session)).toEqual({ ok: true, value: true });
    expect(await store.startSession({ ...session, id: "s-start-2" })).toEqual({ ok: true, value: false });
    expect(await store.findSession("hash-s-start")).toEqual({
      ok: true,
      value: {
        session: {
          id: "s-start",
          userId: "u-start",
          channel: "cookie",
          idleUntil: NOW + SESSION_IDLE_MS,
          expiresAt: NOW + 30 * SESSION_IDLE_MS,
          endedAt: null,
        },
        user: { role: "member", disabled: false, emailVerifiedAt: null, name: "Ada Lovelace", email: "start@example.com" },
      },
    });
  });

  it("finds no session for an unknown hash", async () => {
    expect(await store.findSession("hash-unknown")).toEqual({ ok: true, value: null });
  });

  it("refuses a session for no user, as server", async () => {
    expect(await store.startSession(cookieSession("s-orphan", "u-none"))).toMatchObject({
      ok: false,
      error: { kind: "server" },
    });
  });

  it("refuses a bearer session with an idle window, as server", async () => {
    await createUser("u-bearer", "bearer@example.com");
    const session = cookieSession("s-bearer", "u-bearer", { channel: "bearer" });
    expect(await store.startSession(session)).toMatchObject({ ok: false, error: { kind: "server" } });
  });

  it("moves an idle window once, when two touches race", async () => {
    await createUser("u-touch", "touch@example.com");
    // Less than half the idle window is left, so a touch is due.
    await store.startSession(cookieSession("s-touch", "u-touch", { idleUntil: NOW + SESSION_IDLE_MS / 4 }));
    const touch = { id: "s-touch", idleUntil: NOW + SESSION_IDLE_MS, now: NOW };

    const [first, second] = await Promise.all([store.touchSession(touch), store.touchSession(touch)]);

    expect([first, second]).toContainEqual({ ok: true, value: true });
    expect([first, second]).toContainEqual({ ok: true, value: false });
    const found = await store.findSession("hash-s-touch");
    expect(found.ok && found.value?.session.idleUntil).toBe(NOW + SESSION_IDLE_MS);
  });
});
