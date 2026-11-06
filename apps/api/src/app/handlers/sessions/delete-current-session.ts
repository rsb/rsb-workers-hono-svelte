import type { SignedOutReply } from "@todo/contract-api";
import type { SignOut } from "@todo/operations/auth/sign-out.ts";
import type { Context } from "hono";
import { mapFailure, success } from "../present.ts";
import { sessionIdOf } from "./session-id.ts";

/**
 * `DELETE /sessions/current`: end the session the request came by. Nothing
 * to validate. The BFF deletes its own cookie (L40, L50).
 */
export const deleteCurrentSession = (signOut: SignOut) => async (c: Context) => {
  const actor = c.get("actor");
  const signedOut = await signOut(actor, sessionIdOf(actor));
  if (!signedOut.ok) {
    return mapFailure(c, signedOut.error);
  }

  const reply: SignedOutReply = { signedOut: true };
  return success(c, reply);
};
