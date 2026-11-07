import { CURRENT_PEPPER_ID, type PasswordHash } from "@todo/business/auth/credential.ts";
import { type Result, ok } from "@todo/business/result.ts";
import type { AnyFail } from "@todo/fail/fail.ts";
import type { Hasher } from "../../../src/auth/sign-in.ts";

/**
 * A hasher with no Argon2 in it: a password's "hash" is the password with a
 * prefix, so a test writes a stored hash by hand. It records every check
 * and every hash, so a test can count them (threats row 7: one check
 * whether or not the email is known). `stale` says which stored hashes need
 * a rehash; `failVerify` and `failHash` make a call answer them instead.
 */
export const fakeHasher = (
  options: {
    stale?: (stored: PasswordHash) => boolean;
    failVerify?: Result<boolean, AnyFail>;
    failHash?: Result<PasswordHash, AnyFail>;
  } = {},
) => {
  const verified: { password: string; stored: PasswordHash }[] = [];
  const hashed: string[] = [];
  const hasher: Hasher = {
    hash: async (password) => {
      hashed.push(password);
      return options.failHash ?? ok({ secret: `fake:${password}`, pepperId: CURRENT_PEPPER_ID });
    },
    verify: async (password, stored) => {
      verified.push({ password, stored });
      return options.failVerify ?? ok(stored.secret === `fake:${password}`);
    },
    needsRehash: (stored) => options.stale?.(stored) ?? false,
  };
  return { hasher, verified, hashed };
};
