import type { PasswordHash } from "@todo/business/auth/credential.ts";
import type { Result } from "@todo/business/result.ts";
import type { AnyFail } from "@todo/fail/fail.ts";

/**
 * What sign-in needs to check a password and to hash one (L48): a port of
 * the `auth` area, bound in the api, not a store. Each call runs Argon2id
 * once, so its CPU is in the operation's budget, not in a data case.
 *
 * - `hash`: the password's hash at `ARGON2_PARAMS`, under
 *   `CURRENT_PEPPER_ID`.
 * - `verify`: whether the password is the one `stored` was made from. A
 *   mismatch is `false`, never a failure; a hash the hasher cannot read, or
 *   a pepper id it holds no secret for, is `server`.
 * - `needsRehash`: whether `stored` was made at parameters or under a
 *   pepper that are no longer the current ones. It reads the PHC string
 *   and runs no hash.
 */
export type Hasher = {
  hash(password: string): Promise<Result<PasswordHash, AnyFail>>;
  verify(password: string, stored: PasswordHash): Promise<Result<boolean, AnyFail>>;
  needsRehash(stored: PasswordHash): boolean;
};
