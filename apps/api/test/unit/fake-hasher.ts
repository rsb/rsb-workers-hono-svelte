import type { PasswordHash } from "@todo/business/auth/credential.ts";
import { CURRENT_PEPPER_ID } from "@todo/business/auth/credential.ts";
import { ok } from "@todo/business/result.ts";
import type { Hasher } from "@todo/operations/auth/sign-in.ts";

/**
 * A hasher with no Argon2 in it, for the unit tier: a password's "hash" is
 * the password with a prefix, so a test can write a stored hash by hand.
 * It records each check it makes, so a test can count them (threats row 7:
 * one check whether or not the email is known). The real one is tested in
 * `auth/hasher.test.ts` and in workerd by the integration tests.
 */
export const fakeHasher = (options: { stale?: (stored: PasswordHash) => boolean } = {}) => {
  const verified: PasswordHash[] = [];
  const hasher: Hasher = {
    hash: async (password) => ok({ secret: `fake:${password}`, pepperId: CURRENT_PEPPER_ID }),
    verify: async (password, stored) => {
      verified.push(stored);
      return ok(stored.secret === `fake:${password}`);
    },
    needsRehash: (stored) => options.stale?.(stored) ?? false,
  };
  return { hasher, verified };
};
