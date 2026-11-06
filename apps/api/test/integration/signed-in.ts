import { exports } from "cloudflare:workers";

// Every todo operation requires a member (`prd/todo/access.md`), so a test
// that reaches one sends a session. `seed-sessions.ts` starts one bearer
// session for each actor below in every test file's fresh identity
// database. A bearer token is used so a request needs no browser headers:
// the channel gate checks only the session cookie.

/** The two signed-in actors: their user ids, and their raw bearer tokens (43 base64url characters). */
export const MEMBER = { userId: "u-member", token: "m".repeat(43), role: "member" } as const;
export const ADMIN = { userId: "u-admin", token: "a".repeat(43), role: "admin" } as const;

/** Sends a request to the Worker with `actor`'s bearer token. */
export const fetchAs = (actor: { token: string }, input: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${actor.token}`);
  return exports.default.fetch(input, { ...init, headers });
};

/** Sends a request to the Worker as the member. */
export const asMember = (input: string, init?: RequestInit) => fetchAs(MEMBER, input, init);
