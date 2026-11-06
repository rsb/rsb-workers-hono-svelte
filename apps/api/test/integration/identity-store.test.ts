import { type NewSession, SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { SESSIONS_LIST_MAX } from "@todo/business/rules.ts";
import { createIdentityStore } from "@todo/data-d1/identity/store.ts";
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
  label: null,
  city: null,
  ...overrides,
});

/** A session stored by sign-in's own write, with no presented session and no rehash. */
const start = async (session: NewSession) => {
  expect(await store.recordSignIn({ session })).toEqual({ ok: true, value: { started: true } });
};

/** The columns no store method reads back whole, read straight from the table. */
const stored = async (id: string) => {
  return env.IDENTITY_DB.prepare(
    "SELECT ended_at, ended_reason, touched_at, idle_until, label, city FROM sessions WHERE id = ?1",
  )
    .bind(id)
    .first<{
      ended_at: number | null;
      ended_reason: string | null;
      touched_at: number;
      idle_until: number | null;
      label: string | null;
      city: string | null;
    }>();
};

const OLD_PHC = "$argon2id$v=19$m=19456,t=2,p=1$b2xk$b2xk";
const NEW_PHC = "$argon2id$v=19$m=19456,t=2,p=1$bmV3$bmV3";

const setPassword = async (userId: string, secret = OLD_PHC) => {
  const set = await store.setCredential({ userId, kind: "password", secret, pepperId: 1, now: NOW });
  expect(set).toEqual({ ok: true, value: undefined });
};

const storedSecret = async (userId: string) => {
  const credential = await env.IDENTITY_DB.prepare("SELECT secret, pepper_id, created_at, updated_at FROM credentials WHERE user_id = ?1")
    .bind(userId)
    .all<{ secret: string; pepper_id: number; created_at: number; updated_at: number }>();
  return credential.results;
};

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

describe("credentials", () => {
  it("sets a password and finds it with its user, by email", async () => {
    await createUser("u-cred", "cred@example.com");
    await setPassword("u-cred");

    expect(await store.findForSignIn("cred@example.com")).toEqual({
      ok: true,
      value: {
        user: { id: "u-cred", role: "member", disabled: false, emailVerifiedAt: null },
        credential: { secret: OLD_PHC, pepperId: 1 },
      },
    });
  });

  it("rewrites the one credential of a kind on a second set, keeping when it was created", async () => {
    await createUser("u-reset", "reset@example.com");
    await setPassword("u-reset");

    const set = await store.setCredential({ userId: "u-reset", kind: "password", secret: NEW_PHC, pepperId: 2, now: NOW + 5 });

    expect(set).toEqual({ ok: true, value: undefined });
    expect(await storedSecret("u-reset")).toEqual([{ secret: NEW_PHC, pepper_id: 2, created_at: NOW, updated_at: NOW + 5 }]);
  });

  it("finds nothing for a user with no password, or an unknown email", async () => {
    await createUser("u-nopass", "nopass@example.com");

    expect(await store.findForSignIn("nopass@example.com")).toEqual({ ok: true, value: null });
    expect(await store.findForSignIn("nobody-cred@example.com")).toEqual({ ok: true, value: null });
  });

  it("refuses a credential for no user, as server", async () => {
    const set = await store.setCredential({ userId: "u-none", kind: "password", secret: OLD_PHC, pepperId: 1, now: NOW });
    expect(set).toMatchObject({ ok: false, error: { kind: "server" } });
  });
});

describe("identity.sign_in", () => {
  it("starts a session once per token hash, and finds it with its user", async () => {
    await createUser("u-start", "start@example.com");
    const session = cookieSession("s-start", "u-start", { label: "Firefox on Linux", city: "Lisbon" });

    expect(await store.recordSignIn({ session })).toEqual({ ok: true, value: { started: true } });
    expect(await store.recordSignIn({ session: { ...session, id: "s-start-2" } })).toEqual({
      ok: true,
      value: { started: false },
    });
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
    expect(await stored("s-start")).toMatchObject({ touched_at: NOW, label: "Firefox on Linux", city: "Lisbon" });
  });

  it("starts a bearer session as it is given, as the seed does", async () => {
    await createUser("u-seed-bearer", "seed-bearer@example.com");

    await start(cookieSession("s-seed-bearer", "u-seed-bearer", { channel: "bearer", idleUntil: null }));

    const found = await store.findSession("hash-s-seed-bearer");
    expect(found.ok && found.value?.session).toMatchObject({ channel: "bearer", idleUntil: null });
  });

  it("refuses a session for no user, as server", async () => {
    expect(await store.recordSignIn({ session: cookieSession("s-orphan", "u-none") })).toMatchObject({
      ok: false,
      error: { kind: "server" },
    });
  });

  it("refuses a bearer session with an idle window, as server", async () => {
    await createUser("u-bearer", "bearer@example.com");
    const session = cookieSession("s-bearer", "u-bearer", { channel: "bearer" });
    expect(await store.recordSignIn({ session })).toMatchObject({ ok: false, error: { kind: "server" } });
  });

  it("ends the presented session as rotated, whoever it belonged to (threats row 3)", async () => {
    await createUser("u-victim", "victim@example.com");
    await createUser("u-rotator", "rotator@example.com");
    await start(cookieSession("s-presented", "u-victim"));

    const signedIn = await store.recordSignIn({ session: cookieSession("s-rotated-in", "u-rotator", { createdAt: NOW + 7 }), rotate: "s-presented" });

    expect(signedIn).toEqual({ ok: true, value: { started: true } });
    expect(await stored("s-presented")).toMatchObject({ ended_at: NOW + 7, ended_reason: "rotated" });
  });

  it("leaves a presented session that already ended as it ended", async () => {
    await createUser("u-gone", "gone@example.com");
    await start(cookieSession("s-gone", "u-gone"));
    await store.endSession({ ownerId: "u-gone" }, { id: "s-gone", reason: "signed_out", now: NOW + 1 });

    expect(await store.recordSignIn({ session: cookieSession("s-after-gone", "u-gone"), rotate: "s-gone" })).toEqual({
      ok: true,
      value: { started: true },
    });

    expect(await stored("s-gone")).toMatchObject({ ended_at: NOW + 1, ended_reason: "signed_out" });
  });

  it("writes nothing when the insert fails: the rotation is in the same transaction", async () => {
    await createUser("u-atomic", "atomic@example.com");
    await start(cookieSession("s-atomic", "u-atomic"));

    const failed = await store.recordSignIn({ session: cookieSession("s-atomic-orphan", "u-none"), rotate: "s-atomic" });

    expect(failed).toMatchObject({ ok: false, error: { kind: "server" } });
    expect(await stored("s-atomic")).toMatchObject({ ended_at: null, ended_reason: null });
  });

  it("still rotates when the token hash is taken, and stores no second row", async () => {
    await createUser("u-taken", "taken@example.com");
    await start(cookieSession("s-taken", "u-taken"));
    await start(cookieSession("s-taken-presented", "u-taken"));

    const again = await store.recordSignIn({
      session: cookieSession("s-taken-2", "u-taken", { tokenHash: "hash-s-taken" }),
      rotate: "s-taken-presented",
    });

    expect(again).toEqual({ ok: true, value: { started: false } });
    expect(await stored("s-taken-2")).toBeNull();
    expect(await stored("s-taken-presented")).toMatchObject({ ended_reason: "rotated" });
  });

  it("rehashes compare-and-set on the PHC string it read", async () => {
    await createUser("u-rehash", "rehash@example.com");
    await setPassword("u-rehash");
    const rehash = { userId: "u-rehash", secret: NEW_PHC, pepperId: 2, previousSecret: OLD_PHC };

    const first = await store.recordSignIn({ session: cookieSession("s-rehash-1", "u-rehash", { createdAt: NOW + 3 }), rehash });
    const stale = await store.recordSignIn({ session: cookieSession("s-rehash-2", "u-rehash"), rehash: { ...rehash, secret: "$argon2id$late" } });

    expect(first).toEqual({ ok: true, value: { started: true, rehashed: true } });
    expect(stale).toEqual({ ok: true, value: { started: true, rehashed: false } });
    expect(await storedSecret("u-rehash")).toEqual([{ secret: NEW_PHC, pepper_id: 2, created_at: NOW, updated_at: NOW + 3 }]);
  });

  it("rehashes once when two sign-ins race", async () => {
    await createUser("u-race", "race@example.com");
    await setPassword("u-race");
    const rehash = (secret: string) => ({ userId: "u-race", secret, pepperId: 2, previousSecret: OLD_PHC });

    const [a, b] = await Promise.all([
      store.recordSignIn({ session: cookieSession("s-race-a", "u-race"), rehash: rehash("$argon2id$a") }),
      store.recordSignIn({ session: cookieSession("s-race-b", "u-race"), rehash: rehash("$argon2id$b") }),
    ]);

    const rehashed = [a, b].map((result) => result.ok && result.value.rehashed);
    expect(rehashed.sort()).toEqual([false, true]);
  });
});

describe("sessions", () => {
  it("finds no session for an unknown hash", async () => {
    expect(await store.findSession("hash-unknown")).toEqual({ ok: true, value: null });
  });

  it("moves an idle window once, when two touches race, and records the touch", async () => {
    await createUser("u-touch", "touch@example.com");
    // Less than half the idle window is left, so a touch is due.
    await start(cookieSession("s-touch", "u-touch", { idleUntil: NOW + SESSION_IDLE_MS / 4 }));
    const touch = { id: "s-touch", idleUntil: NOW + SESSION_IDLE_MS + 5, now: NOW + 5 };

    const [first, second] = await Promise.all([store.touchSession(touch), store.touchSession(touch)]);

    expect([first, second]).toContainEqual({ ok: true, value: true });
    expect([first, second]).toContainEqual({ ok: true, value: false });
    expect(await stored("s-touch")).toMatchObject({ idle_until: NOW + SESSION_IDLE_MS + 5, touched_at: NOW + 5 });
  });

  it("never touches an ended session back to life (threats row 10)", async () => {
    await createUser("u-revive", "revive@example.com");
    await start(cookieSession("s-revive", "u-revive", { idleUntil: NOW + SESSION_IDLE_MS / 4 }));
    await store.endSession({ ownerId: "u-revive" }, { id: "s-revive", reason: "signed_out", now: NOW + 1 });

    const touched = await store.touchSession({ id: "s-revive", idleUntil: NOW + SESSION_IDLE_MS, now: NOW + 2 });

    expect(touched).toEqual({ ok: true, value: false });
    expect(await stored("s-revive")).toMatchObject({ ended_at: NOW + 1, idle_until: NOW + SESSION_IDLE_MS / 4, touched_at: NOW });
  });

  it("ends one of the owner's sessions once, with its reason", async () => {
    await createUser("u-end", "end@example.com");
    await start(cookieSession("s-end", "u-end"));
    const end = { id: "s-end", reason: "signed_out" as const, now: NOW + 4 };

    expect(await store.endSession({ ownerId: "u-end" }, end)).toEqual({ ok: true, value: true });
    expect(await store.endSession({ ownerId: "u-end" }, { ...end, now: NOW + 8 })).toEqual({ ok: true, value: false });
    expect(await stored("s-end")).toMatchObject({ ended_at: NOW + 4, ended_reason: "signed_out" });
  });

  it("does not end another's session, and says so as already ended", async () => {
    await createUser("u-mine", "mine@example.com");
    await start(cookieSession("s-theirs", "u-mine"));

    const ended = await store.endSession({ ownerId: "u-other" }, { id: "s-theirs", reason: "signed_out", now: NOW });

    expect(ended).toEqual({ ok: true, value: false });
    expect(await stored("s-theirs")).toMatchObject({ ended_at: null });
  });

  it("ends every live session of the owner's together, and leaves the rest as they are", async () => {
    await createUser("u-all", "all@example.com");
    await createUser("u-all-other", "all-other@example.com");
    await start(cookieSession("s-all-1", "u-all"));
    await start(cookieSession("s-all-bearer", "u-all", { channel: "bearer", idleUntil: null }));
    await start(cookieSession("s-all-idle", "u-all", { idleUntil: NOW - 1 }));
    await start(cookieSession("s-all-expired", "u-all", { expiresAt: NOW }));
    await start(cookieSession("s-all-ended", "u-all"));
    await store.endSession({ ownerId: "u-all" }, { id: "s-all-ended", reason: "signed_out", now: NOW - 5 });
    await start(cookieSession("s-all-other", "u-all-other"));

    const ended = await store.endAllSessions({ ownerId: "u-all" }, { reason: "signed_out_everywhere", now: NOW });

    expect(ended).toEqual({ ok: true, value: 2 });
    expect(await stored("s-all-1")).toMatchObject({ ended_at: NOW, ended_reason: "signed_out_everywhere" });
    expect(await stored("s-all-bearer")).toMatchObject({ ended_at: NOW, ended_reason: "signed_out_everywhere" });
    expect(await stored("s-all-idle")).toMatchObject({ ended_at: null });
    expect(await stored("s-all-expired")).toMatchObject({ ended_at: null });
    expect(await stored("s-all-ended")).toMatchObject({ ended_at: NOW - 5, ended_reason: "signed_out" });
    expect(await stored("s-all-other")).toMatchObject({ ended_at: null });
  });

  it("lists the owner's live sessions, most recently touched first", async () => {
    await createUser("u-list", "list@example.com");
    await createUser("u-list-other", "list-other@example.com");
    await start(cookieSession("s-list-b", "u-list", { createdAt: NOW - 20, label: "Safari on iPhone", city: "Porto" }));
    await start(cookieSession("s-list-a", "u-list", { createdAt: NOW - 20 }));
    await start(cookieSession("s-list-new", "u-list", { createdAt: NOW - 10, label: "Firefox on Linux" }));
    await start(cookieSession("s-list-idle", "u-list", { idleUntil: NOW }));
    await start(cookieSession("s-list-ended", "u-list"));
    await store.endSession({ ownerId: "u-list" }, { id: "s-list-ended", reason: "signed_out", now: NOW - 1 });
    await start(cookieSession("s-list-other", "u-list-other"));

    expect(await store.listSessions({ ownerId: "u-list" }, { now: NOW })).toEqual({
      ok: true,
      value: {
        sessions: [
          { id: "s-list-new", label: "Firefox on Linux", city: null, createdAt: NOW - 10, touchedAt: NOW - 10 },
          // Touched at the same moment, so by id.
          { id: "s-list-a", label: null, city: null, createdAt: NOW - 20, touchedAt: NOW - 20 },
          { id: "s-list-b", label: "Safari on iPhone", city: "Porto", createdAt: NOW - 20, touchedAt: NOW - 20 },
        ],
        more: false,
      },
    });
  });

  it("stops at the bound and says more were live", async () => {
    await createUser("u-many", "many@example.com");
    for (let i = 0; i <= SESSIONS_LIST_MAX; i++) {
      await start(cookieSession(`s-many-${String(i).padStart(2, "0")}`, "u-many", { createdAt: NOW - 100 + i }));
    }

    const listed = await store.listSessions({ ownerId: "u-many" }, { now: NOW });

    expect(listed.ok && listed.value.more).toBe(true);
    expect(listed.ok && listed.value.sessions).toHaveLength(SESSIONS_LIST_MAX);
    // The least recently touched is the one left out.
    expect(listed.ok && listed.value.sessions.map((each) => each.id)).not.toContain("s-many-00");
  });

  it("holds an ended reason to an ended session, and an ended session to a reason", async () => {
    await createUser("u-check", "check@example.com");
    await start(cookieSession("s-check", "u-check"));

    const reasonOnly = env.IDENTITY_DB.prepare("UPDATE sessions SET ended_reason = 'signed_out' WHERE id = ?1").bind("s-check");
    const endOnly = env.IDENTITY_DB.prepare("UPDATE sessions SET ended_at = ?2 WHERE id = ?1").bind("s-check", NOW);

    await expect(reasonOnly.run()).rejects.toThrow(/CHECK constraint failed/);
    await expect(endOnly.run()).rejects.toThrow(/CHECK constraint failed/);
  });

  it("leaves the reason's values to the EndedReason type, so a later slice adds one without a rebuild", async () => {
    await createUser("u-open", "open@example.com");
    await start(cookieSession("s-open", "u-open"));

    await env.IDENTITY_DB.prepare("UPDATE sessions SET ended_at = ?2, ended_reason = 'password_changed' WHERE id = ?1")
      .bind("s-open", NOW)
      .run();

    expect(await stored("s-open")).toMatchObject({ ended_at: NOW, ended_reason: "password_changed" });
  });
});
