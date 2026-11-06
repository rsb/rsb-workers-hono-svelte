import type { Result } from "@todo/business/result.ts";
import type { Reason } from "@todo/contract-api";
import { type AnyFail, Fail, chainOf, forbidden, unauthenticated, wrap } from "@todo/fail/fail.ts";
import type { Authenticate } from "@todo/gates/authenticate.ts";
import type { MiddlewareHandler } from "hono";
import { mapFailure, userFailure } from "../app/handlers/present.ts";
import { readCredentials } from "./credentials.ts";

/** What the binding needs to move a session's idle window (`data/identity.md › sessions.touch`). */
export type SessionTouch = {
  touchSession(input: { id: string; idleUntil: number; now: number }): Promise<Result<boolean, AnyFail>>;
};

/**
 * The fourth gate (L39): the binding of the `authenticate` unit. It reads
 * the credentials, runs the unit and attaches what it found: the actor, the
 * profile and `clearCookie`. What the unit refuses is answered here:
 * `unauthenticated`, or `forbidden` with the reason `account_disabled`.
 *
 * When the session's idle window is due to move, the touch runs after the
 * response, through `waitUntil` (L40): the request does not wait for it,
 * and a touch that fails is logged, never answered.
 */
export const authenticate = (deps: {
  unit: Authenticate;
  sessions: SessionTouch;
  now: () => number;
  sessionCookie: string;
}): MiddlewareHandler => {
  return async (c, next) => {
    const now = deps.now();
    const credentials = readCredentials(c, deps.sessionCookie);
    const result = await deps.unit({ credentials, now });

    if (!result.ok) {
      const refused = result.error;
      if (refused instanceof Fail) {
        return mapFailure(c, refused);
      }
      if (refused.kind === "unauthenticated") {
        return userFailure(c, unauthenticated(refused.message));
      }
      return userFailure(c, forbidden("account_disabled" satisfies Reason, refused.message));
    }

    const { actor, profile, clearCookie, refreshDue } = result.value;
    c.set("actor", actor);
    c.set("profile", profile);
    c.set("clearCookie", clearCookie);

    if (refreshDue !== undefined) {
      const log = c.get("log");
      const touch = async () => {
        const touched = await deps.sessions.touchSession({ id: refreshDue.sessionId, idleUntil: refreshDue.idleUntil, now });
        if (!touched.ok) {
          const fail = wrap(touched.error, "touch session");
          log.error({ method: c.req.method, path: c.req.path, kind: fail.kind, message: fail.message, chain: chainOf(fail) });
        }
      };
      c.executionCtx.waitUntil(touch());
    }
    await next();
  };
};
