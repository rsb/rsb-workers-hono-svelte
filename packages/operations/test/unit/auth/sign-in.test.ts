import type { Actor } from "@todo/business/auth/actor.ts";
import { DUMMY_PASSWORD_HASH, type SignIn, type SignInCredential, type SignInWrite, type SignInWritten } from "@todo/business/auth/credential.ts";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, rootOf, serverFault, unavailable } from "@todo/fail/fail.ts";
import { describe, expect, it } from "vitest";
import { type Device, signIn } from "../../../src/auth/sign-in.ts";
import { admin, anonymous, member } from "../actors.ts";
import { fakeHasher } from "./fake-hasher.ts";

const NOW = Date.UTC(2026, 10, 6, 12);
const TOKEN = "n".repeat(43);
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";
const device: Device = { userAgent: FIREFOX_LINUX, city: "Lisbon" };
const input = { email: "ada@example.com", password: "correct horse battery staple" };

/** Ada, whose stored hash is the fake hasher's for `input.password`. */
const ada: SignInCredential = {
  user: { id: "u1", role: "member", disabled: false, emailVerifiedAt: NOW - 1000 },
  credential: { secret: `fake:${input.password}`, pepperId: 1 },
};

/** A fake of the sign-in port: `found` for every email, `written` for every batch, each call recorded. */
const fakeStore = (
  found: Result<SignInCredential | null, AnyFail> = ok(ada),
  written: Result<SignInWritten, AnyFail> = ok({ started: true }),
) => {
  const asked: string[] = [];
  const writes: SignInWrite[] = [];
  return {
    asked,
    writes,
    findForSignIn: async (email: string) => {
      asked.push(email);
      return found;
    },
    recordSignIn: async (write: SignInWrite) => {
      writes.push(write);
      return written;
    },
  };
};

/** A log port that keeps what it was given. */
const fakeLog = () => {
  const entries: Record<string, unknown>[] = [];
  return { entries, error: (entry: Record<string, unknown>) => void entries.push(entry) };
};

const build = (identityStore = fakeStore(), hasher = fakeHasher()) => {
  const log = fakeLog();
  const operation = signIn({
    identityStore,
    hasher: hasher.hasher,
    digest: async (token) => `hash:${token}`,
    newId: () => "s-new",
    newToken: () => TOKEN,
    now: () => NOW,
  });
  return {
    identityStore,
    hasher,
    log,
    run: (actor: Actor, given: SignIn, from: Device) => operation(actor, given, from, log),
  };
};

const INVALID = { kind: "invalid_credentials", message: "the email and password do not match an account" };

describe("signIn, with the right password", () => {
  it("starts a cookie session with the constants' windows and gives the raw token and its expiry", async () => {
    const { run, identityStore } = build();

    const signedIn = await run(anonymous, input, device);

    expect(signedIn).toEqual({ ok: true, value: { token: TOKEN, expiresAt: NOW + SESSION_ABSOLUTE_MS } });
    expect(identityStore.asked).toEqual(["ada@example.com"]);
    expect(identityStore.writes).toEqual([
      {
        session: {
          id: "s-new",
          tokenHash: `hash:${TOKEN}`,
          userId: "u1",
          channel: "cookie",
          createdAt: NOW,
          idleUntil: NOW + SESSION_IDLE_MS,
          expiresAt: NOW + SESSION_ABSOLUTE_MS,
          label: "Firefox on Linux",
          city: "Lisbon",
        },
      },
    ]);
  });

  it("stores only the token's hash, never the token (L40)", async () => {
    const { run, identityStore } = build();
    await run(anonymous, input, device);
    expect(JSON.stringify(identityStore.writes)).not.toContain(`"${TOKEN}"`);
  });

  it("stores no label or city when the request gave neither", async () => {
    const { run, identityStore } = build();
    await run(anonymous, input, { userAgent: undefined, city: undefined });
    expect(identityStore.writes[0]?.session).toMatchObject({ label: null, city: null });
  });

  it("threats row 3: ends the session the request presented, in the same batch, as rotated", async () => {
    const { run, identityStore } = build();
    await run(member, input, device);
    expect(identityStore.writes[0]?.rotate).toBe("s1");
  });

  it("ends the presented session whoever it belonged to", async () => {
    // The admin's browser signs in as Ada: the admin's session still ends.
    const { run, identityStore } = build();
    await run(admin, input, device);
    expect(identityStore.writes[0]).toMatchObject({ session: { userId: "u1" }, rotate: "s-admin" });
  });

  it("asks for no rotation when the request presented no session", async () => {
    const { run, identityStore } = build();
    await run(anonymous, input, device);
    expect(identityStore.writes[0]).not.toHaveProperty("rotate");
  });

  it("does not check whether the email is verified in B", async () => {
    const unverified = { ...ada, user: { ...ada.user, emailVerifiedAt: null } };
    const { run } = build(fakeStore(ok(unverified)));
    expect((await run(anonymous, input, device)).ok).toBe(true);
  });
});

describe("signIn, rehashing (L48)", () => {
  it("hashes the password again and writes it compare-and-set on the old PHC string, in the batch", async () => {
    const hasher = fakeHasher({ stale: () => true });
    const { run, identityStore } = build(fakeStore(), hasher);

    await run(anonymous, input, device);

    expect(hasher.hashed).toEqual([input.password]);
    expect(identityStore.writes[0]?.rehash).toEqual({
      userId: "u1",
      secret: `fake:${input.password}`,
      pepperId: 1,
      previousSecret: ada.credential.secret,
    });
  });

  it("hashes nothing when the stored hash is at the current parameters and pepper", async () => {
    const { run, identityStore, hasher, log } = build();
    await run(anonymous, input, device);
    expect(hasher.hashed).toEqual([]);
    expect(identityStore.writes[0]).not.toHaveProperty("rehash");
    expect(log.entries).toEqual([]);
  });

  it("is not refused when another sign-in landed the rehash first", async () => {
    const store = fakeStore(ok(ada), ok({ started: true, rehashed: false }));
    const { run } = build(store, fakeHasher({ stale: () => true }));
    expect(await run(anonymous, input, device)).toEqual({ ok: true, value: { token: TOKEN, expiresAt: NOW + SESSION_ABSOLUTE_MS } });
  });

  it("never rehashes on a wrong password", async () => {
    const hasher = fakeHasher({ stale: () => true });
    const { run, identityStore } = build(fakeStore(), hasher);
    await run(anonymous, { ...input, password: "wrong" }, device);
    expect(hasher.hashed).toEqual([]);
    expect(identityStore.writes).toEqual([]);
  });

  it("defers a rehash the hasher cannot make: signs in, writes no rehash, and logs one fault", async () => {
    const broken = serverFault("argon2 could not hash: out of memory");
    const hasher = fakeHasher({ stale: () => true, failHash: err(broken) });
    const { run, identityStore, log } = build(fakeStore(), hasher);

    const signedIn = await run(anonymous, input, device);

    expect(signedIn).toEqual({ ok: true, value: { token: TOKEN, expiresAt: NOW + SESSION_ABSOLUTE_MS } });
    expect(identityStore.writes).toHaveLength(1);
    expect(identityStore.writes[0]).not.toHaveProperty("rehash");
    expect(log.entries).toEqual([
      {
        operation: "signIn",
        kind: "server",
        message: "sign in: rehash deferred: argon2 could not hash: out of memory",
        chain: ["server: argon2 could not hash: out of memory"],
      },
    ]);
    expect(JSON.stringify(log.entries)).not.toContain(input.password);
  });
});

describe("signIn, refused (threats row 7: one refusal, one cost)", () => {
  it("refuses a wrong password, stores nothing, and leaves the presented session as it was", async () => {
    const { run, identityStore, hasher } = build();

    const signedIn = await run(member, { ...input, password: "wrong" }, device);

    expect(signedIn).toEqual({ ok: false, error: expect.objectContaining(INVALID) });
    expect(hasher.verified).toHaveLength(1);
    expect(identityStore.writes).toEqual([]);
  });

  it("refuses an unknown email the same way, after checking the dummy hash exactly once", async () => {
    const { run, identityStore, hasher } = build(fakeStore(ok(null)));

    const signedIn = await run(member, input, device);

    expect(signedIn).toEqual({ ok: false, error: expect.objectContaining(INVALID) });
    expect(hasher.verified).toEqual([{ password: input.password, stored: DUMMY_PASSWORD_HASH }]);
    expect(identityStore.writes).toEqual([]);
  });

  it("refuses a disabled user with the right password the same way, after one check", async () => {
    const disabled = { ...ada, user: { ...ada.user, disabled: true } };
    const { run, identityStore, hasher } = build(fakeStore(ok(disabled)));

    const signedIn = await run(anonymous, input, device);

    expect(signedIn).toEqual({ ok: false, error: expect.objectContaining(INVALID) });
    expect(hasher.verified).toHaveLength(1);
    expect(identityStore.writes).toEqual([]);
  });

  it("gives the three refusals one body", async () => {
    const bodies = await Promise.all([
      build().run(anonymous, { ...input, password: "wrong" }, device),
      build(fakeStore(ok(null))).run(anonymous, input, device),
      build(fakeStore(ok({ ...ada, user: { ...ada.user, disabled: true } }))).run(anonymous, input, device),
    ]);
    const shown = bodies.map((body) => (body.ok ? body : { kind: body.error.kind, message: body.error.message }));
    expect(new Set(shown.map((body) => JSON.stringify(body))).size).toBe(1);
  });
});

describe("signIn, failing", () => {
  it("wraps the store's failure to read, keeping its kind and root, and checks no password", async () => {
    const down = unavailable("sign in: D1_ERROR: Network connection lost.");
    const { run, hasher } = build(fakeStore(err(down)));

    const signedIn = await run(anonymous, input, device);

    if (signedIn.ok) {
      throw new Error("expected a failure");
    }
    expect(signedIn.error.kind).toBe("unavailable");
    expect(rootOf(signedIn.error)).toBe(down);
    expect(hasher.verified).toEqual([]);
  });

  it("is server when the hasher cannot check, never a refusal", async () => {
    const broken = serverFault("no pepper is configured for pepper id 7");
    const { run, identityStore } = build(fakeStore(), fakeHasher({ failVerify: err(broken) }));

    const signedIn = await run(anonymous, input, device);

    expect(signedIn).toMatchObject({ ok: false, error: { kind: "server" } });
    expect(!signedIn.ok && rootOf(signedIn.error)).toBe(broken);
    expect(identityStore.writes).toEqual([]);
  });

  it("wraps the batch's failure, keeping its kind and root", async () => {
    const down = unavailable("sign in: D1_ERROR: Network connection lost.");
    const { run } = build(fakeStore(ok(ada), err(down)));

    const signedIn = await run(anonymous, input, device);

    expect(signedIn).toMatchObject({ ok: false, error: { kind: "unavailable" } });
    expect(!signedIn.ok && rootOf(signedIn.error)).toBe(down);
  });

  it("is server when the token hash is taken: no retry, and no token for a row that was not stored", async () => {
    const { run, identityStore } = build(fakeStore(ok(ada), ok({ started: false })));

    const signedIn = await run(anonymous, input, device);

    expect(signedIn).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: "server", message: "sign in: the new session's token hash is already taken" }),
    });
    expect(identityStore.writes).toHaveLength(1);
  });
});
