import type { Actor, Profile } from "@todo/business/auth/actor.ts";
import type { SessionChannel } from "@todo/business/auth/session.ts";
import type { Log } from "../log.ts";

/** How a request reaches the api (L38): the BFF's session cookie, a bearer token, or neither. */
export type Channel = SessionChannel | "none";

// What the gates attach to every request, in the order they run (L38). Hono
// reads this map for `c.get` and `c.set`, so a handler that reads one is
// typed without naming the gates. A handler's unit test builds a bare
// `Context`, with nothing attached: what it reads is undefined there.
declare module "hono" {
  interface ContextVariableMap {
    /** `requestId`: the request's id, minted by the gate. */
    requestId: string;
    /** `requestId`: the log, bound to that id. */
    log: Log;
    /** `channel`: how the request came. */
    channel: Channel;
    /** `authenticate`: who the request acts for. */
    actor: Actor;
    /** `authenticate`: what the frame shows of a signed-in actor. */
    profile: Profile | undefined;
    /** `authenticate`: the session cookie names no live session, so the BFF deletes it. */
    clearCookie: boolean;
  }
}
