// The hasher (L48), bound in the api. The Worker and the dev seed share this
// one code path: each hands it an Argon2 instance, the Worker's from the
// `.wasm` imported as a module (index.ts), the seed's from the package's
// Node entry. So it never imports the `.wasm` itself.

import Argon2, { Argon2Type } from "@phi-ag/argon2";
import { ARGON2_PARAMS, CURRENT_PEPPER_ID, type PasswordHash } from "@todo/business/auth/credential.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, serverFault } from "@todo/fail/fail.ts";
import type { Hasher } from "@todo/operations/auth/sign-in.ts";

/** The pepper secrets by id, as `readConfig` reads them: `PEPPER_1` is id 1. */
export type Peppers = Readonly<Record<number, string>>;

/** The package's words for a password that does not match: every other `tryVerify` error is ours. */
const MISMATCH = "The password does not match the supplied hash";

/**
 * The PHC string's head as `ARGON2_PARAMS` writes it: Argon2id, version 19,
 * then m, t and p, which set the cost. The salt and output lengths are not
 * in the head; a change to them alone does not call for a rehash.
 */
const CURRENT_HEAD = `$argon2id$v=19$m=${ARGON2_PARAMS.memoryCost},t=${ARGON2_PARAMS.timeCost},p=${ARGON2_PARAMS.parallelism}$`;

/**
 * The Worker's Argon2, from the `.wasm` the platform compiled: a builder,
 * so `createHasher` instantiates it on the first sign-in, not at startup.
 */
export const argon2FromWasm = (module: WebAssembly.Module) => () => new Argon2(new WebAssembly.Instance(module));

/**
 * Builds the hasher from an Argon2 instance and the peppers. `argon2` is
 * called on the first hash or check, once: the Worker instantiates the
 * module only when a request needs it.
 *
 * The input Argon2id hashes is the password, NFKC-normalized, keyed with
 * the pepper by HMAC-SHA256, as base64url: 43 ASCII characters whatever the
 * password, so the hash's cost never depends on its length (L47). NFKC
 * first, so the same password typed on two keyboards is one password.
 */
export const createHasher = (deps: { argon2: () => Argon2; peppers: Peppers }): Hasher => {
  let instance: Argon2 | undefined;
  const argon2 = () => {
    instance ??= deps.argon2();
    return instance;
  };

  const keyed = async (password: string, pepperId: number): Promise<Result<string, AnyFail>> => {
    const pepper = deps.peppers[pepperId];
    if (pepper === undefined) {
      return err(serverFault(`no pepper is configured for pepper id ${pepperId}`));
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(password.normalize("NFKC")));
    return ok(base64url(new Uint8Array(mac)));
  };

  return {
    hash: async (password) => {
      const input = await keyed(password, CURRENT_PEPPER_ID);
      if (!input.ok) {
        return input;
      }
      const salt = crypto.getRandomValues(new Uint8Array(ARGON2_PARAMS.saltLength));
      const hashed = argon2().tryHash(input.value, {
        memoryCost: ARGON2_PARAMS.memoryCost,
        timeCost: ARGON2_PARAMS.timeCost,
        parallelism: ARGON2_PARAMS.parallelism,
        hashLength: ARGON2_PARAMS.hashLength,
        salt,
        type: Argon2Type.Argon2id,
      });
      if (!hashed.success) {
        return err(serverFault(`argon2 could not hash: ${hashed.error}`));
      }
      return ok({ secret: hashed.data.encoded, pepperId: CURRENT_PEPPER_ID });
    },

    verify: async (password, stored) => {
      const input = await keyed(password, stored.pepperId);
      if (!input.ok) {
        return input;
      }
      if (!stored.secret.startsWith("$argon2id$")) {
        return err(serverFault("the stored password hash is not an Argon2id PHC string"));
      }
      const checked = argon2().tryVerify(stored.secret, input.value, Argon2Type.Argon2id);
      if (checked.success) {
        return ok(true);
      }
      if (checked.error === MISMATCH) {
        return ok(false);
      }
      return err(serverFault(`argon2 could not check the stored password hash: ${checked.error}`));
    },

    needsRehash: (stored: PasswordHash) => stored.pepperId !== CURRENT_PEPPER_ID || !stored.secret.startsWith(CURRENT_HEAD),
  };
};

/** Bytes as base64url without padding. */
const base64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
