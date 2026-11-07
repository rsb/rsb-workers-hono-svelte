import { SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { Failure } from "@todo/contract-api";
import { createIdentityStore } from "@todo/data-d1/identity/store.ts";
import { env, exports } from "cloudflare:workers";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

/**
 * The gates on the real Worker (L38, L39): the token's hash is SHA-256 in
 * hex, the session is read from the identity database, and the cookie is
 * the configured one. The unit and binding branches are tested without
 * workerd; this proves the parts only workerd has. Here who a request was
 * taken for is told by its status: the route refuses an anonymous count
 * (401), the gate a disabled user's session (403), and a member's goes
 * through. `sessions-current.test.ts` reads the actor back.
 */

const store = createIdentityStore(env.IDENTITY_DB);

/** SHA-256 in hex, written out apart from the api's, so the two must agree. */
const sha256 = async (text: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const startSession = async (token: string, userId: string, disabled = false) => {
  const now = Date.now();
  const email = `${userId}@example.com`;
  expect(await store.createUser({ id: userId, email, name: "Ada", role: "member", createdAt: now })).toEqual({ ok: true, value: true });
  if (disabled) {
    await env.IDENTITY_DB.prepare("UPDATE users SET disabled = 1 WHERE id = ?1").bind(userId).run();
  }
  const started = await store.recordSignIn({
    session: {
      id: `s-${userId}`,
      tokenHash: await sha256(token),
      userId,
      channel: "cookie",
      createdAt: now,
      idleUntil: now + SESSION_IDLE_MS,
      expiresAt: now + 30 * SESSION_IDLE_MS,
      label: null,
      city: null,
    },
  });
  expect(started).toEqual({ ok: true, value: { started: true } });
};

const counts = (headers: Record<string, string>) => exports.default.fetch("https://todo-api/todos/counts", { headers });

describe("authenticate, on the identity database", () => {
  // Only a session the gate found can be a disabled user's, so the refusal
  // proves the lookup: the hash, the statement and the cookie's name.
  it("finds a session by the SHA-256 of its token, under the configured cookie", async () => {
    const token = "d".repeat(43);
    await startSession(token, "u-disabled", true);

    const response = await counts({ Cookie: `${env.SESSION_COOKIE}=${token}` });

    expect(response.status).toBe(403);
    expect(v.parse(Failure, await response.json()).error).toEqual({
      kind: "forbidden",
      reason: "account_disabled",
      message: "the account is disabled",
    });
  });

  it("reads no cookie of another name", async () => {
    const other = "o".repeat(43);
    await startSession(other, "u-other", true);

    const response = await counts({ Cookie: `other=${other}` });

    // Anonymous, so the count's row refuses it; the disabled user's
    // session would have been a 403.
    expect(response.status).toBe(401);
    expect(v.parse(Failure, await response.json()).error.kind).toBe("unauthenticated");
  });
});

describe("channel, with the configured cookie and origin", () => {
  it("lets the BFF's own change through", async () => {
    await startSession("c".repeat(43), "u-channel");

    const response = await exports.default.fetch("https://todo-api/todos", {
      method: "POST",
      body: '{"title":"buy milk"}',
      headers: { Cookie: `${env.SESSION_COOKIE}=${"c".repeat(43)}`, "Content-Type": "application/json", Origin: env.BFF_ORIGIN },
    });

    expect(response.status).toBe(201);
  });

  it("refuses a change from another origin", async () => {
    const response = await exports.default.fetch("https://todo-api/todos", {
      method: "POST",
      body: '{"title":"buy milk"}',
      headers: { Cookie: `${env.SESSION_COOKIE}=${"c".repeat(43)}`, "Content-Type": "application/json", Origin: "https://evil.test" },
    });

    expect(response.status).toBe(403);
    expect(v.parse(Failure, await response.json()).error).toMatchObject({ kind: "forbidden", reason: "channel" });
  });
});
