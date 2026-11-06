import type { Credentials } from "@todo/gates/authenticate.ts";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";

/**
 * The credentials a request carries: the session cookie, by its configured
 * name, and the token of `Authorization: Bearer`. An `Authorization` of any
 * other form is kept whole, so the unit refuses it as no token rather than
 * the request passing as anonymous.
 */
export const readCredentials = (c: Context, sessionCookie: string): Credentials => {
  const cookie = getCookie(c, sessionCookie);
  const authorization = c.req.header("Authorization");
  if (authorization === undefined) {
    return { cookie, bearer: undefined };
  }
  const bearer = /^Bearer +(\S+)$/i.exec(authorization);
  return { cookie, bearer: bearer?.[1] ?? authorization };
};
