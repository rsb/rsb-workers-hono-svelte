import type { Actor } from "@todo/business/auth/actor.ts";
import type { SignIn } from "@todo/business/auth/credential.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { Failure, SignedInReply, envelope } from "@todo/contract-api";
import { type AnyFail, invalidCredentials, unavailable } from "@todo/fail/fail.ts";
import type { Device, SignInOperation, SignedIn } from "@todo/operations/auth/sign-in.ts";
import type { Log } from "@todo/operations/log.ts";
import { toSignIn } from "@todo/valid/auth/sign-in.ts";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { postSessions } from "../../../../../src/app/handlers/sessions/post-sessions.ts";
import { member } from "../actor.ts";

const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";

/** A sign-in that answers `answer` and records what it was given. */
const fakeSignIn = (answer: Result<SignedIn, AnyFail> = ok({ token: "t".repeat(43), expiresAt: 1794700800000 })) => {
  const given: { actor: Actor; input: SignIn; device: Device; log: Log }[] = [];
  const signIn: SignInOperation = async (actor, input, device, log) => {
    given.push({ actor, input, device, log });
    return answer;
  };
  return { signIn, given };
};

/** A `POST /sessions` with what the gates attach already on it, and `cf` as the platform gives it. */
const post = (body: unknown, options: { actor?: Actor; headers?: Record<string, string>; cf?: unknown } = {}) => {
  const request = new Request("https://todo-api/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (options.cf !== undefined) {
    Object.defineProperty(request, "cf", { value: options.cf });
  }
  const c = new Context(request);
  c.set("actor", options.actor ?? { kind: "anonymous" });
  return c;
};

const input = { email: "  Ada@Example.com ", password: "correct horse battery staple" };

describe("postSessions", () => {
  it("signs in with the decoded input and answers 201 with the token and its expiry", async () => {
    const { signIn, given } = fakeSignIn();

    const response = await postSessions(signIn, toSignIn)(post(input));

    expect(response.status).toBe(201);
    expect(v.parse(envelope(SignedInReply), await response.json())).toEqual({
      ok: true,
      data: { token: "t".repeat(43), expiresAt: 1794700800000 },
    });
    expect(given[0]?.input).toEqual({ email: "ada@example.com", password: "correct horse battery staple" });
  });

  it("runs as the actor the gate attached, so a presented session is the one ended", async () => {
    const { signIn, given } = fakeSignIn();
    await postSessions(signIn, toSignIn)(post(input, { actor: member }));
    expect(given[0]?.actor).toBe(member);
  });

  it("passes the User-Agent and request.cf's city on as the device", async () => {
    const { signIn, given } = fakeSignIn();
    await postSessions(signIn, toSignIn)(post(input, { headers: { "User-Agent": FIREFOX_LINUX }, cf: { city: "Lisbon", country: "PT" } }));
    expect(given[0]?.device).toEqual({ userAgent: FIREFOX_LINUX, city: "Lisbon" });
  });

  it("passes no city when request.cf has none, or one that is not text", async () => {
    for (const cf of [undefined, {}, { city: "" }, { city: 7 }]) {
      const { signIn, given } = fakeSignIn();
      await postSessions(signIn, toSignIn)(post(input, { cf }));
      expect(given[0]?.device, JSON.stringify(cf)).toEqual({ userAgent: undefined, city: undefined });
    }
  });

  it("refuses a body that breaks a rule as validation, without signing in", async () => {
    const { signIn, given } = fakeSignIn();

    const response = await postSessions(signIn, toSignIn)(post({ email: "ada", password: "pw" }));

    expect(response.status).toBe(422);
    expect(v.parse(Failure, await response.json()).error).toEqual({
      kind: "validation",
      message: "email is not a valid email address",
      field: "email",
    });
    expect(given).toEqual([]);
  });

  it("refuses a body the contract does not take, without signing in", async () => {
    const { signIn, given } = fakeSignIn();
    const response = await postSessions(signIn, toSignIn)(post({ email: "ada@example.com" }));
    expect(response.status).toBe(422);
    expect(given).toEqual([]);
  });

  it("answers invalid_credentials as 401, with the operation's message", async () => {
    const { signIn } = fakeSignIn(err(invalidCredentials("the email and password do not match an account")));

    const response = await postSessions(signIn, toSignIn)(post(input));

    expect(response.status).toBe(401);
    expect(v.parse(Failure, await response.json()).error).toEqual({
      kind: "invalid_credentials",
      message: "the email and password do not match an account",
    });
  });

  it("answers a store failure as internal", async () => {
    const { signIn } = fakeSignIn(err(unavailable("sign in: D1_ERROR: Network connection lost.")));
    const response = await postSessions(signIn, toSignIn)(post(input));
    expect(response.status).toBe(500);
  });
});
