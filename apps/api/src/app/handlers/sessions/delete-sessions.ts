import type { SignedOutReply } from "@todo/contract-api";
import type { SignOutEverywhere } from "@todo/operations/auth/sign-out-everywhere.ts";
import type { Context } from "hono";
import { mapFailure, success } from "../present.ts";

/**
 * `DELETE /sessions`: end every live session of the actor's, this one
 * included (L50). Nothing to validate. The BFF deletes this device's cookie.
 */
export const deleteSessions = (signOutEverywhere: SignOutEverywhere) => async (c: Context) => {
  const signedOut = await signOutEverywhere(c.get("actor"));
  if (!signedOut.ok) {
    return mapFailure(c, signedOut.error);
  }

  const reply: SignedOutReply = { signedOut: true };
  return success(c, reply);
};
