import type { Actor } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import type { EndedReason } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/**
 * What signing out everywhere needs from the identity store: "end every
 * live session of the owner", answered with how many were ended
 * (`data/identity.md › sessions.end_all`).
 */
export type SignOutEverywhereStore = {
  endAllSessions(scope: Own, input: { reason: EndedReason; now: number }): Promise<Result<number, AnyFail>>;
};

export type SignOutEverywhere = (actor: Actor) => Promise<Result<undefined, AnyFail>>;

/**
 * Ends every live session of the actor, this one included (L50). No
 * re-authentication: the caller's own session ends too, so a cookie thief
 * who runs it keeps nothing (threats row 10). How many were ended is not
 * the caller's to know.
 *
 * Use case: `prd/todo/use-cases/auth/sign-out-everywhere.md`
 */
export const signOutEverywhere = (deps: { identityStore: SignOutEverywhereStore; now: () => number }): SignOutEverywhere =>
  run("signOutEverywhere", async (scope) => {
    const ended = await deps.identityStore.endAllSessions(scope, { reason: "signed_out_everywhere", now: deps.now() });
    if (!ended.ok) {
      return err(wrap(ended.error, "sign out everywhere"));
    }
    return ok(undefined);
  });
