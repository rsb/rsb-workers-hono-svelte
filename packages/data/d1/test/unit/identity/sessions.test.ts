import { SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { describe, expect, it } from "vitest";
import { type FoundRow, type NewSession, sessionStore } from "../../../src/identity/sessions.ts";
import { fakeD1 } from "../fake-d1.ts";

const NOW = Date.UTC(2026, 10, 5, 12);

const found: FoundRow = {
  id: "s1",
  user_id: "u1",
  channel: "cookie",
  idle_until: NOW + 1000,
  expires_at: NOW + 2000,
  ended_at: null,
  role: "admin",
  disabled: 0,
  email_verified_at: null,
  name: "Ada Lovelace",
  email: "ada@example.com",
};

describe("findSession", () => {
  it("binds the hash it is given", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await sessionStore(db).findSession("hash-1");

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.bound).toEqual(["hash-1"]);
  });

  it("reads the row back as the session and its user", async () => {
    const { db } = fakeD1({ rows: [found] });

    expect(await sessionStore(db).findSession("hash-1")).toEqual({
      ok: true,
      value: {
        session: { id: "s1", userId: "u1", channel: "cookie", idleUntil: NOW + 1000, expiresAt: NOW + 2000, endedAt: null },
        user: { role: "admin", disabled: false, emailVerifiedAt: null, name: "Ada Lovelace", email: "ada@example.com" },
      },
    });
  });

  it("reports a disabled user as disabled", async () => {
    const { db } = fakeD1({ rows: [{ ...found, disabled: 1 }] });

    const result = await sessionStore(db).findSession("hash-1");

    expect(result.ok && result.value?.user.disabled).toBe(true);
  });

  it("reports null when no session has the hash", async () => {
    const { db } = fakeD1({ rows: [] });

    expect(await sessionStore(db).findSession("hash-1")).toEqual({ ok: true, value: null });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    expect(await sessionStore(db).findSession("hash-1")).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "select session by token hash: D1_ERROR: Network connection lost." },
    });
  });
});

describe("touchSession", () => {
  it("binds the id, the new window, and now plus half the idle window", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await sessionStore(db).touchSession({ id: "s1", idleUntil: NOW + SESSION_IDLE_MS, now: NOW });

    expect(prepared[0]?.bound).toEqual(["s1", NOW + SESSION_IDLE_MS, NOW + SESSION_IDLE_MS / 2]);
  });

  it.each([
    [1, true],
    [0, false],
  ])("reports %i changed rows as touched: %s", async (changes, touched) => {
    const { db } = fakeD1({ changes });

    expect(await sessionStore(db).touchSession({ id: "s1", idleUntil: NOW, now: NOW })).toEqual({
      ok: true,
      value: touched,
    });
  });
});

describe("startSession", () => {
  const session: NewSession = {
    id: "s1",
    tokenHash: "hash-1",
    userId: "u1",
    channel: "bearer",
    createdAt: NOW,
    idleUntil: null,
    expiresAt: NOW + 2000,
  };

  it("binds the session in column order", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await sessionStore(db).startSession(session);

    expect(prepared[0]?.bound).toEqual(["s1", "hash-1", "u1", "bearer", NOW, null, NOW + 2000]);
  });

  it.each([
    [1, true],
    [0, false],
  ])("reports %i changed rows as started: %s", async (changes, started) => {
    const { db } = fakeD1({ changes });

    expect(await sessionStore(db).startSession(session)).toEqual({ ok: true, value: started });
  });
});
