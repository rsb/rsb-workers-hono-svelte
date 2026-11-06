import argon2Wasm from "@phi-ag/argon2/argon2.wasm";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { DeviceSessionListReply, SessionReply, SignedInReply, success } from "@todo/contract-api";
import { createIdentityStore } from "@todo/data-d1/identity/store.ts";
import { env, exports } from "cloudflare:workers";
import * as v from "valibot";
import { beforeAll, describe, expect, it } from "vitest";
import { argon2FromWasm, createHasher } from "../../src/auth/hasher.ts";
import { readConfig } from "../../src/config.ts";
import { sha256Hex } from "../../src/gates/digest.ts";
import { ADMIN, MEMBER } from "./signed-in.ts";

/**
 * The session endpoints on the real Worker: the real hasher, the real
 * identity database and the real gates. What threats rows 3, 7 and 10 say
 * is pinned here, against the statements, not a fake. Requests are sent as
 * the BFF sends them: the session cookie, and `Sec-Fetch-Site:
 * same-origin` on a change.
 */

const store = createIdentityStore(env.IDENTITY_DB);
const EMAIL = `${MEMBER.userId}@example.com`;
const PASSWORD = "correct horse battery staple";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";

beforeAll(async () => {
  // The member's password, hashed by the hasher the Worker builds, under
  // the integration config's pepper.
  const config = readConfig(env);
  if (!config.ok) {
    throw new Error("the integration config does not read");
  }
  const hashed = await createHasher({ argon2: argon2FromWasm(argon2Wasm), peppers: config.value.peppers }).hash(PASSWORD);
  if (!hashed.ok) {
    throw hashed.error;
  }
  const set = await store.setCredential({ userId: MEMBER.userId, kind: "password", ...hashed.value, now: Date.now() });
  if (!set.ok) {
    throw set.error;
  }
});

const cookie = (token: string) => `${env.SESSION_COOKIE}=${token}`;

/** A change as the BFF's page sends it, with the cookie when given one. */
const change = (method: string, path: string, init: { token?: string; body?: unknown; headers?: Record<string, string>; cf?: object } = {}) =>
  exports.default.fetch(
    new Request(`https://todo-api${path}`, {
      method,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      headers: {
        "Sec-Fetch-Site": "same-origin",
        "Content-Type": "application/json",
        ...(init.token === undefined ? {} : { Cookie: cookie(init.token) }),
        ...init.headers,
      },
      // As the BFF passes the browser request's on: the platform's object, here only its city.
      ...(init.cf === undefined ? {} : { cf: init.cf as RequestInitCfProperties }),
    }),
  );

const signIn = (body: unknown = { email: EMAIL, password: PASSWORD }, init: { token?: string; headers?: Record<string, string>; cf?: object } = {}) =>
  change("POST", "/sessions", { ...init, body });

/** Signs the member in and gives the raw token. */
const signedIn = async (init: { token?: string; headers?: Record<string, string>; cf?: object } = {}) => {
  const response = await signIn(undefined, init);
  expect(response.status).toBe(201);
  return v.parse(success(SignedInReply), await response.json()).data.token;
};

/** Who a cookie reads as now. */
const whoIs = async (token: string) => {
  const response = await exports.default.fetch("https://todo-api/sessions/current", { headers: { Cookie: cookie(token) } });
  return v.parse(success(SessionReply), await response.json()).data;
};

/** The session row a raw token names, as the database holds it. */
const rowOf = async (token: string) =>
  env.IDENTITY_DB.prepare("SELECT id, user_id, channel, ended_at, ended_reason, label, city, idle_until, expires_at FROM sessions WHERE token_hash = ?1")
    .bind(await sha256Hex(token))
    .first<Record<string, unknown>>();

describe("POST /sessions, with the right password", () => {
  it("starts a cookie session the cookie then reads as the member, and gives the token and its expiry", async () => {
    const before = Date.now();
    const response = await signIn();

    expect(response.status).toBe(201);
    const { token, expiresAt } = v.parse(success(SignedInReply), await response.json()).data;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt).toBeGreaterThanOrEqual(before + SESSION_ABSOLUTE_MS);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect((await whoIs(token)).user).toMatchObject({ id: MEMBER.userId, email: EMAIL });
  });

  it("stores the token's hash only, on a cookie row with the idle window", async () => {
    const token = await signedIn();

    const row = await rowOf(token);
    expect(row).toMatchObject({ user_id: MEMBER.userId, channel: "cookie", ended_at: null });
    expect(Number(row?.idle_until)).toBeLessThanOrEqual(Date.now() + SESSION_IDLE_MS);
    const raw = await env.IDENTITY_DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?1").bind(token).first<{ n: number }>();
    expect(raw?.n).toBe(0);
  });

  it("keeps the User-Agent's label and request.cf's city, as the BFF passes them on (L51)", async () => {
    const token = await signedIn({ headers: { "User-Agent": FIREFOX_LINUX }, cf: { city: "Lisbon" } });
    expect(await rowOf(token)).toMatchObject({ label: "Firefox on Linux", city: "Lisbon" });
  });

  it("keeps neither when the request gave neither", async () => {
    const token = await signedIn();
    expect(await rowOf(token)).toMatchObject({ label: null, city: null });
  });
});

describe("threats row 3: a sign-in ends the session it was presented", () => {
  it("ends the member's own presented session as rotated, so the old cookie reads as no one", async () => {
    const old = await signedIn();

    const fresh = await signedIn({ token: old });

    expect(await rowOf(old)).toMatchObject({ ended_reason: "rotated" });
    expect(await whoIs(old)).toEqual({ clearCookie: true });
    expect((await whoIs(fresh)).user?.id).toBe(MEMBER.userId);
  });

  it("ends another user's presented session too: a fixed cookie never outlives a sign-in", async () => {
    // The admin's cookie session, then the member signs in on that browser.
    const adminToken = "f".repeat(43);
    const now = Date.now();
    const started = await store.recordSignIn({
      session: {
        id: "s-admin-cookie",
        tokenHash: await sha256Hex(adminToken),
        userId: ADMIN.userId,
        channel: "cookie",
        createdAt: now,
        idleUntil: now + SESSION_IDLE_MS,
        expiresAt: now + SESSION_ABSOLUTE_MS,
        label: null,
        city: null,
      },
    });
    expect(started).toEqual({ ok: true, value: { started: true } });

    const memberToken = await signedIn({ token: adminToken });

    expect(await rowOf(adminToken)).toMatchObject({ ended_reason: "rotated" });
    expect((await whoIs(memberToken)).user?.id).toBe(MEMBER.userId);
  });

  it("leaves the presented session as it was when the sign-in is refused", async () => {
    const old = await signedIn();

    const response = await signIn({ email: EMAIL, password: "wrong horse battery staple" }, { token: old });

    expect(response.status).toBe(401);
    expect(await rowOf(old)).toMatchObject({ ended_at: null });
  });
});

describe("threats row 7: one refusal for every way the credentials fail", () => {
  const refusals = async () => {
    // A disabled user whose password is the member's, so only "disabled" refuses them.
    const hash = await env.IDENTITY_DB.prepare("SELECT secret, pepper_id FROM credentials WHERE user_id = ?1")
      .bind(MEMBER.userId)
      .first<{ secret: string; pepper_id: number }>();
    if (hash === null) {
      throw new Error("the member has no credential");
    }
    await store.createUser({ id: "u-disabled", email: "disabled@example.com", name: "u-disabled", role: "member", createdAt: Date.now() });
    await env.IDENTITY_DB.prepare("UPDATE users SET disabled = 1 WHERE id = ?1").bind("u-disabled").run();
    await store.setCredential({ userId: "u-disabled", kind: "password", secret: hash.secret, pepperId: hash.pepper_id, now: Date.now() });
    return Promise.all([
      signIn({ email: EMAIL, password: "wrong horse battery staple" }),
      signIn({ email: "nobody@example.com", password: PASSWORD }),
      signIn({ email: `${MEMBER.userId}@EXAMPLE.com`, password: "Correct horse battery staple" }),
      signIn({ email: "disabled@example.com", password: PASSWORD }),
    ]);
  };

  it("answers a wrong password, an unknown email and a disabled user with one status, one body and one set of headers", async () => {
    const responses = await refusals();
    const shown = await Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: await response.text(),
        headers: [...response.headers.entries()].filter(([name]) => name !== "date"),
      })),
    );

    expect(shown[0]?.status).toBe(401);
    expect(JSON.parse(shown[0]?.body ?? "")).toEqual({
      ok: false,
      error: { kind: "invalid_credentials", message: "the email and password do not match an account" },
    });
    for (const each of shown) {
      expect(each).toEqual(shown[0]);
    }
  });

  it("sends the headers unauthenticated sends, and neither sends WWW-Authenticate", async () => {
    const refused = await signIn({ email: "nobody@example.com", password: PASSWORD });
    const unauthenticated = await exports.default.fetch("https://todo-api/todos", { headers: { Authorization: `Bearer ${"u".repeat(43)}` } });

    const names = (response: Response) => [...response.headers.keys()].filter((name) => name !== "date").sort();
    expect(unauthenticated.status).toBe(401);
    expect(names(refused)).toEqual(names(unauthenticated));
    expect(refused.headers.has("WWW-Authenticate")).toBe(false);
  });
});

describe("threats row 10: a signed-out session stays ended", () => {
  it("sign-out ends the session the cookie names, and the cookie then reads as no one", async () => {
    const token = await signedIn();

    const response = await change("DELETE", "/sessions/current", { token });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { signedOut: true } });
    expect(await rowOf(token)).toMatchObject({ ended_reason: "signed_out" });
    expect(await whoIs(token)).toEqual({ clearCookie: true });
  });

  it("sign-out with a cookie that names no live session is unauthenticated, and ends nothing", async () => {
    const token = await signedIn();
    await change("DELETE", "/sessions/current", { token });

    const again = await change("DELETE", "/sessions/current", { token });

    expect(again.status).toBe(401);
  });

  it("sign-out everywhere ends every live session of the member's, this one too, and no one else's", async () => {
    const here = await signedIn();
    const there = await signedIn();

    const response = await change("DELETE", "/sessions", { token: here });

    expect(response.status).toBe(200);
    expect(await rowOf(here)).toMatchObject({ ended_reason: "signed_out_everywhere" });
    expect(await rowOf(there)).toMatchObject({ ended_reason: "signed_out_everywhere" });
    expect(await whoIs(there)).toEqual({ clearCookie: true });
    const admin = await exports.default.fetch("https://todo-api/sessions/current", { headers: { Authorization: `Bearer ${ADMIN.token}` } });
    expect(v.parse(success(SessionReply), await admin.json()).data.user?.id).toBe(ADMIN.userId);
  });

  it("a sign-out on a session whose touch is due never leaves it revived (addition 1)", async () => {
    // The gate starts the touch beside the handler (waitUntil), so either
    // may land first. Several rounds through the Worker, then the late
    // order made certain: the gate's touch arriving after the end.
    for (let round = 0; round < 5; round++) {
      const token = `${round}`.repeat(43);
      const now = Date.now();
      const due = { id: `s-due-${round}`, idleUntil: now + SESSION_IDLE_MS / 4 };
      const started = await store.recordSignIn({
        session: {
          id: due.id,
          tokenHash: await sha256Hex(token),
          userId: MEMBER.userId,
          channel: "cookie",
          createdAt: now - SESSION_IDLE_MS,
          // Less than half the idle window left: the gate's touch is due.
          idleUntil: due.idleUntil,
          expiresAt: now + SESSION_ABSOLUTE_MS,
          label: null,
          city: null,
        },
      });
      expect(started).toEqual({ ok: true, value: { started: true } });

      const response = await change("DELETE", "/sessions/current", { token });
      expect(response.status).toBe(200);
      // Time for the touch the gate started to land, whichever order it took.
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(await rowOf(token), `round ${round}`).toMatchObject({ ended_reason: "signed_out" });
      expect(await whoIs(token)).toEqual({ clearCookie: true });

      // The touch the gate computed, landing after the end: skipped.
      const late = await store.touchSession({ id: due.id, idleUntil: now + SESSION_IDLE_MS, now });
      expect(late).toEqual({ ok: true, value: false });
      expect(await rowOf(token), `round ${round}`).toMatchObject({ ended_reason: "signed_out" });
      expect(await whoIs(token)).toEqual({ clearCookie: true });
    }
  });
});

describe("GET /sessions", () => {
  it("lists the member's live sessions, this device marked, with the label and city they started with", async () => {
    const other = await signedIn({ headers: { "User-Agent": FIREFOX_LINUX }, cf: { city: "Lisbon" } });
    const here = await signedIn();

    const response = await exports.default.fetch("https://todo-api/sessions", { headers: { Cookie: cookie(here) } });

    expect(response.status).toBe(200);
    const { sessions, more } = v.parse(success(DeviceSessionListReply), await response.json()).data;
    expect(more).toBe(false);
    const hereRow = await rowOf(here);
    const otherRow = await rowOf(other);
    expect(sessions.find((session) => session.thisDevice)?.id).toBe(hereRow?.id);
    expect(sessions.find((session) => session.id === otherRow?.id)).toMatchObject({ label: "Firefox on Linux", city: "Lisbon", thisDevice: false });
    expect(sessions.filter((session) => session.thisDevice)).toHaveLength(1);
  });

  it("refuses no session as unauthenticated", async () => {
    const response = await exports.default.fetch("https://todo-api/sessions");
    expect(response.status).toBe(401);
  });
});
