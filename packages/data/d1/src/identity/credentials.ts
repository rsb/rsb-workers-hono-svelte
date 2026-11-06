import type { Role } from "@todo/business/auth/actor.ts";
import type { CredentialKind, Rehash, SignInCredential } from "@todo/business/auth/credential.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { AnyFail } from "@todo/fail/fail.ts";
import { execute, queryAll } from "../driver.ts";

/** The row `users JOIN credentials` returns. The tables' CHECKs hold `role` and `disabled` to these values. */
export type SignInRow = {
  id: string;
  role: Role;
  disabled: 0 | 1;
  email_verified_at: number | null;
  secret: string;
  pepper_id: number;
};

export const toSignInCredential = (row: SignInRow): SignInCredential => ({
  user: { id: row.id, role: row.role, disabled: row.disabled === 1, emailVerifiedAt: row.email_verified_at },
  credential: { secret: row.secret, pepperId: row.pepper_id },
});

// Stmt: the SQL and its binds, side by side.

/** The user and their password in one statement, the same shape as the gate's `sessions JOIN users`. */
const selectForSignInStmt = (db: D1Database, email: string) => {
  const sql = `
    SELECT u.id, u.role, u.disabled, u.email_verified_at, c.secret, c.pepper_id
    FROM users u
    JOIN credentials c ON c.user_id = u.id AND c.kind = 'password'
    WHERE u.email = ?1`;
  return db.prepare(sql).bind(email);
};

/** One credential of a kind per user: a second set rewrites it and keeps `created_at`. */
const upsertCredentialStmt = (
  db: D1Database,
  input: { userId: string; kind: CredentialKind; secret: string; pepperId: number; now: number },
) => {
  const sql = `
    INSERT INTO credentials (user_id, kind, secret, pepper_id, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?5)
    ON CONFLICT (user_id, kind) DO UPDATE
    SET secret = excluded.secret, pepper_id = excluded.pepper_id, updated_at = excluded.updated_at`;
  return db.prepare(sql).bind(input.userId, input.kind, input.secret, input.pepperId, input.now);
};

/**
 * Compare-and-set on the PHC string read before the password was checked
 * (L48): of two rehashes that race, one changes the row. Only
 * `identity.sign_in`'s batch runs it, so it is exported to that file and
 * has no method of its own.
 */
export const rehashPasswordStmt = (db: D1Database, rehash: Rehash, now: number) => {
  const sql = `
    UPDATE credentials
    SET secret = ?2, pepper_id = ?3, updated_at = ?4
    WHERE user_id = ?1 AND kind = 'password' AND secret = ?5`;
  return db.prepare(sql).bind(rehash.userId, rehash.secret, rehash.pepperId, now, rehash.previousSecret);
};

// Raw: runs a statement and deals only in rows.

const selectForSignInRaw = (db: D1Database, email: string) => {
  return queryAll<SignInRow>(() => selectForSignInStmt(db, email), "select credential for sign-in");
};

const upsertCredentialRaw = (db: D1Database, input: Parameters<typeof upsertCredentialStmt>[1]) => {
  return execute(() => upsertCredentialStmt(db, input), "set credential");
};

/**
 * Outer: the credential methods of the identity store (`data/identity.md`).
 * None takes a scope: sign-in reads before there is an actor, and the seed
 * and slice C's sign-up write for a user who is not signed in.
 */
export const credentialStore = (db: D1Database) => ({
  /** A user and their password credential, by email, or `null` (`credentials.find_for_sign_in`). */
  findForSignIn: async (email: string): Promise<Result<SignInCredential | null, AnyFail>> => {
    const rows = await selectForSignInRaw(db, email);
    if (!rows.ok) {
      return err(rows.error);
    }

    // `email` is UNIQUE and `(user_id, kind)` the key, so there is at most one row.
    const [row] = rows.value;
    if (row === undefined) {
      return ok(null);
    }
    return ok(toSignInCredential(row));
  },

  /** A user's credential of a kind, written whether or not one existed (`credentials.set`). */
  setCredential: async (input: {
    userId: string;
    kind: CredentialKind;
    secret: string;
    pepperId: number;
    now: number;
  }): Promise<Result<undefined, AnyFail>> => {
    const changes = await upsertCredentialRaw(db, input);
    if (!changes.ok) {
      return err(changes.error);
    }
    return ok(undefined);
  },
});
