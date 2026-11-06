import type { SessionReply } from "@todo/contract-api";
import { serverFault } from "@todo/fail/fail.ts";
import type { CurrentSession } from "@todo/operations/auth/current-session.ts";
import type { Context } from "hono";
import { mapFailure, serverFailure, success } from "../present.ts";

/**
 * `GET /sessions/current`: nothing to validate; say who the request acts
 * for, from what the `authenticate` gate attached, then present. An
 * anonymous actor is a reply with no `user`.
 */
export const getCurrentSession = (currentSession: CurrentSession) => async (c: Context) => {
  const attached = { profile: c.get("profile"), clearCookie: c.get("clearCookie") };
  const given = await currentSession(c.get("actor"), attached);
  if (!given.ok) {
    return mapFailure(c, given.error);
  }

  const { actor, profile, clearCookie } = given.value;
  if (actor.kind === "anonymous") {
    const reply: SessionReply = { clearCookie };
    return success(c, reply);
  }
  // The gate reads the profile in the statement that finds the session, so
  // a signed-in actor without one is our bug, not the caller's: it is logged.
  if (profile === undefined) {
    return serverFailure(c, serverFault(`the gate attached user ${actor.userId} with no profile`));
  }
  const reply: SessionReply = {
    user: {
      id: actor.userId,
      role: actor.role,
      emailVerified: actor.emailVerified,
      name: profile.name,
      email: profile.email,
    },
    clearCookie,
  };
  return success(c, reply);
};
