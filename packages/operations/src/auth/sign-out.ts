import type { Actor } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import type { EndedReason } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/**
 * What signing out needs from the identity store: "end this session if it
 * is the owner's and still open", answered with whether it was ended
 * (`data/identity.md › sessions.end`).
 */
export type SignOutStore = {
  endSession(scope: Own, input: { id: string; reason: EndedReason; now: number }): Promise<Result<boolean, AnyFail>>;
};

export type SignOut = (actor: Actor, sessionId: string) => Promise<Result<undefined, AnyFail>>;

/**
 * Ends the session the request presented, the actor's (L50). A session
 * that had already ended is not a refusal: the outcome the caller asked
 * for holds. `sessionId` is the actor's, which the delivery passes on: the
 * runner hands an `own` body the scope, never the actor.
 *
 * Use case: `prd/todo/use-cases/auth/sign-out.md`
 */
export const signOut = (deps: { identityStore: SignOutStore; now: () => number }): SignOut =>
  run("signOut", async (scope, sessionId) => {
    const ended = await deps.identityStore.endSession(scope, { id: sessionId, reason: "signed_out", now: deps.now() });
    if (!ended.ok) {
      return err(wrap(ended.error, "sign out"));
    }
    return ok(undefined);
  });
