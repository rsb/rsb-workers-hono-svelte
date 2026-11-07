import type { Cookies } from "@sveltejs/kit";
import type { ApiError } from "@todo/contract-api";
import { deleteCurrentSession, deleteSessions } from "../api/sessions.ts";
import type { SessionCookie } from "./sign-in.ts";

/** Where a sign-out sends the browser: the list's page, which shows `accounts.shell.signed_out_notice`. */
export const SIGNED_OUT_TO = "/?signed-out";

/**
 * What a sign-out's response asks the browser to clear, as a courtesy
 * beside the expiring cookie (L50): its cached pages. Not `"cookies"`,
 * which reaches every cookie of the registrable domain, so on a shared
 * parent domain it would sign the person out of its other apps; the
 * expiring cookie already deletes the one this app owns. The api's own
 * end of the session is what signs the person out.
 */
export const CLEAR_SITE_DATA = '"cache"';

/**
 * Whether a refused sign-out still leaves the person signed out.
 * `unauthenticated` is a cookie that names no live session (another
 * sign-out, a sign-out everywhere or a rotation ended it first): the
 * outcome the person asked for holds (`sign-out.md`). Every other kind is
 * `accounts.error.failed`. A store failure leaves unknown whether the
 * session ended, so the cookie stays and signing out again is safe. Every
 * kind must be placed, so a new one does not compile until it is.
 */
const isSignedOut = (refused: ApiError): boolean => {
  switch (refused.kind) {
    case "unauthenticated":
      return true;
    case "invalid_credentials":
    case "validation":
    case "forbidden":
    case "not_found":
    case "limit":
    case "too_large":
    case "internal":
      return false;
    default: {
      const unplaced: never = refused;
      return unplaced;
    }
  }
};

/** The reply of either sign-out, as `call` reads it. */
type SignOutReply = Awaited<ReturnType<typeof deleteCurrentSession>>;

/**
 * What both sign-outs do with the api's reply: on success, or when the
 * cookie already names no live session, delete the session cookie with an
 * expiring `Set-Cookie`; on any other refusal, throw, with the cookie kept.
 */
const forget = (reply: SignOutReply, cookies: Pick<Cookies, "delete">, cookie: SessionCookie, what: string) => {
  if (!reply.ok && !isSignedOut(reply.error)) {
    throw new Error(`${what} failed`, { cause: reply.error });
  }
  cookies.delete(cookie.name, { path: "/", httpOnly: true, secure: cookie.secure, sameSite: "lax" });
  return { signedOut: true as const };
};

/**
 * The shell's sign-out: ask the api to end this device's session, then
 * delete the session cookie with an expiring `Set-Cookie`. Gives
 * `{ signedOut: true }`, and the route sends the browser to the notice;
 * or throws, for `accounts.error.failed`, with the cookie kept.
 */
export async function signOut(api: Pick<Fetcher, "fetch">, cookies: Pick<Cookies, "delete">, cookie: SessionCookie) {
  return forget(await deleteCurrentSession(api), cookies, cookie, "sign-out");
}

/**
 * The profile's "Sign out everywhere": ask the api to end every session of
 * the actor's, this device's included (L50), then delete this device's
 * cookie as sign-out does. Another device finds itself signed out on its
 * next request (`sign-out-everywhere.md`).
 */
export async function signOutEverywhere(api: Pick<Fetcher, "fetch">, cookies: Pick<Cookies, "delete">, cookie: SessionCookie) {
  return forget(await deleteSessions(api), cookies, cookie, "sign-out everywhere");
}
