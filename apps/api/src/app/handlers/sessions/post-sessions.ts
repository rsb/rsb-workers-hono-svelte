import { SignInBody, type SignedInReply } from "@todo/contract-api";
import type { Device, SignInOperation } from "@todo/operations/auth/sign-in.ts";
import type { toSignIn } from "@todo/valid/auth/sign-in.ts";
import type { Context } from "hono";
import { type Log, consoleLog } from "../../../log.ts";
import { invalidOf } from "../messages.ts";
import { created, mapFailure, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";

/** The validator construct gives this handler (L33). */
type ToSignIn = typeof toSignIn;

/**
 * What the request says about the device it came from (L51): the
 * `User-Agent` the BFF forwards, and the city from `request.cf`, which the
 * BFF passes on from the browser's request. Display only: neither is
 * checked, and nothing is decided by either.
 */
const deviceOf = (c: Context): Device => {
  const cf = c.req.raw.cf as { city?: unknown } | undefined;
  const city = typeof cf?.city === "string" && cf.city !== "" ? cf.city : undefined;
  return { userAgent: c.req.header("User-Agent"), city };
};

/**
 * `POST /sessions`: validate the body, make it a sign-in, sign in, then
 * present the raw token and its expiry. The BFF keeps the token as its
 * cookie; the api never writes `Set-Cookie` (L40).
 */
export const postSessions = (signIn: SignInOperation, toSignIn: ToSignIn) => async (c: Context) => {
  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, SignInBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  // The email and password must follow the identity input rules (L47).
  const signInput = toSignIn({ email: body.value.email, password: body.value.password });
  if (!signInput.ok) {
    return userFailure(c, invalidOf(signInput.error));
  }

  // It runs as the actor the gate attached: a session the request presented
  // is the one a sign-in ends (threats row 3). A rehash the hasher cannot
  // make is logged through the request's log, not answered.
  const log: Log | undefined = c.get("log");
  const signedIn = await signIn(c.get("actor"), signInput.value, deviceOf(c), log ?? consoleLog(null));
  if (!signedIn.ok) {
    return mapFailure(c, signedIn.error);
  }

  const reply: SignedInReply = { token: signedIn.value.token, expiresAt: signedIn.value.expiresAt };
  return created(c, reply);
};
