import type { SignInWrite, SignInWritten } from "@todo/business/auth/credential.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { serverFault, type AnyFail } from "@todo/fail/fail.ts";
import { executeBatch } from "../driver.ts";
import { rehashPasswordStmt } from "./credentials.ts";
import { endSessionStmt, insertSessionStmt } from "./sessions.ts";

// Raw: runs a statement and deals only in rows.

/**
 * The insert, then the rotation, then the rehash, as one batch, so one
 * transaction. Without a presented session or a due rehash it is the
 * insert alone.
 */
const signInRaw = (db: D1Database, write: SignInWrite) => {
  const now = write.session.createdAt;
  return executeBatch(
    db,
    () => [
      insertSessionStmt(db, write.session),
      ...(write.rotate === undefined ? [] : [endSessionStmt(db, write.rotate, "rotated", now)]),
      ...(write.rehash === undefined ? [] : [rehashPasswordStmt(db, write.rehash, now)]),
    ],
    "sign in",
  );
};

/**
 * Outer: the sign-in method of the identity store (`data/identity.md ›
 * identity.sign_in`). It writes `sessions` and `credentials`, so it has a
 * file of its own rather than either table's. It takes no scope: there is
 * no actor until it succeeds.
 */
export const signInStore = (db: D1Database) => ({
  /**
   * Whether the session was stored (not when its token hash is taken) and,
   * with a rehash, whether it landed (not when another write got there
   * first). The rotation's count is not reported: an already ended session
   * is what the caller asked for.
   */
  recordSignIn: async (write: SignInWrite): Promise<Result<SignInWritten, AnyFail>> => {
    const changes = await signInRaw(db, write);
    if (!changes.ok) {
      return err(changes.error);
    }

    const started = changes.value[0];
    if (started === undefined) {
      return err(serverFault("sign in: the batch returned no result for the insert"));
    }
    if (write.rehash === undefined) {
      return ok({ started: started === 1 });
    }
    // The rehash is the batch's last statement.
    return ok({ started: started === 1, rehashed: changes.value.at(-1) === 1 });
  },
});
