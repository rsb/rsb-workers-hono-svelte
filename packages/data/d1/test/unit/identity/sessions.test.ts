import { SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { SESSIONS_LIST_MAX } from "@todo/business/rules.ts";
import { describe, expect, it } from "vitest";
import { type FoundRow, sessionStore } from "../../../src/identity/sessions.ts";
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
  it("binds the id, the new window, now plus half the idle window, and now as the last touch", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await sessionStore(db).touchSession({ id: "s1", idleUntil: NOW + SESSION_IDLE_MS, now: NOW });

    expect(prepared[0]?.bound).toEqual(["s1", NOW + SESSION_IDLE_MS, NOW + SESSION_IDLE_MS / 2, NOW]);
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

describe("endSession", () => {
  it("binds the id, the reason, now and the owner", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await sessionStore(db).endSession({ ownerId: "u1" }, { id: "s1", reason: "signed_out", now: NOW });

    expect(prepared[0]?.bound).toEqual(["s1", "signed_out", NOW, "u1"]);
  });

  it.each([
    [1, true],
    [0, false],
  ])("reports %i changed rows as ended: %s", async (changes, ended) => {
    const { db } = fakeD1({ changes });

    expect(await sessionStore(db).endSession({ ownerId: "u1" }, { id: "s1", reason: "signed_out", now: NOW })).toEqual({
      ok: true,
      value: ended,
    });
  });
});

describe("endAllSessions", () => {
  it("binds the owner, now and the reason, and reports how many ended", async () => {
    const { db, prepared } = fakeD1({ changes: 3 });

    const result = await sessionStore(db).endAllSessions({ ownerId: "u1" }, { reason: "signed_out_everywhere", now: NOW });

    expect(prepared[0]?.bound).toEqual(["u1", NOW, "signed_out_everywhere"]);
    expect(result).toEqual({ ok: true, value: 3 });
  });
});

describe("listSessions", () => {
  const row = (id: string) => ({ id, label: "Firefox on Linux", city: null, created_at: NOW - 10, touched_at: NOW - 5 });

  it("binds the owner, now and one more than the bound", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await sessionStore(db).listSessions({ ownerId: "u1" }, { now: NOW });

    expect(prepared[0]?.bound).toEqual(["u1", NOW, SESSIONS_LIST_MAX + 1]);
  });

  it("reads each row back as a listed session, with nothing more", async () => {
    const { db } = fakeD1({ rows: [row("s1")] });

    expect(await sessionStore(db).listSessions({ ownerId: "u1" }, { now: NOW })).toEqual({
      ok: true,
      value: {
        sessions: [{ id: "s1", label: "Firefox on Linux", city: null, createdAt: NOW - 10, touchedAt: NOW - 5 }],
        more: false,
      },
    });
  });

  it("returns the bound and says more when the extra row came back", async () => {
    const rows = Array.from({ length: SESSIONS_LIST_MAX + 1 }, (_, i) => row(`s${i}`));
    const { db } = fakeD1({ rows });

    const result = await sessionStore(db).listSessions({ ownerId: "u1" }, { now: NOW });

    expect(result.ok && result.value.sessions).toHaveLength(SESSIONS_LIST_MAX);
    expect(result.ok && result.value.more).toBe(true);
  });

  it("says no more at exactly the bound", async () => {
    const rows = Array.from({ length: SESSIONS_LIST_MAX }, (_, i) => row(`s${i}`));
    const { db } = fakeD1({ rows });

    const result = await sessionStore(db).listSessions({ ownerId: "u1" }, { now: NOW });

    expect(result.ok && result.value.sessions).toHaveLength(SESSIONS_LIST_MAX);
    expect(result.ok && result.value.more).toBe(false);
  });
});
