import type { Actor, Profile } from "@todo/business/auth/actor.ts";
import { type Result, ok } from "@todo/business/result.ts";
import type { AnyFail } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/** What the `authenticate` gate attached beside the actor: the profile, and whether to clear the cookie. */
export type Attached = { profile: Profile | undefined; clearCookie: boolean };

/** Who the request acts for, as the shell reads it. */
export type Session = { actor: Actor; profile: Profile | undefined; clearCookie: boolean };

export type CurrentSession = (actor: Actor, attached: Attached) => Promise<Result<Session, AnyFail>>;

/**
 * Says who the request acts for, from what the gate attached: it reads
 * nothing of its own and refuses no one. Its scope is `n/a`, so the runner
 * hands it the actor. Construct builds it from stage 23's commit 8, so its
 * row in `access.md` names an operation; `GET /sessions/current` routes to
 * it from commit 9.
 *
 * Use case: `prd/todo/use-cases/auth/current-session.md`
 */
export const currentSession = (): CurrentSession =>
  run("currentSession", async (actor, attached) => {
    // A profile is a signed-in actor's; an anonymous one has none to show.
    const profile = actor.kind === "user" ? attached.profile : undefined;
    return ok({ actor, profile, clearCookie: attached.clearCookie });
  });
