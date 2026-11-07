import type { Actor } from "@todo/business/auth/actor.ts";
import {
  DUMMY_PASSWORD_HASH,
  type PasswordHash,
  type Rehash,
  type SignIn,
  type SignInCredential,
  type SignInWrite,
  type SignInWritten,
} from "@todo/business/auth/credential.ts";
import { deviceLabel } from "@todo/business/auth/device-label.ts";
import { type NewSession, SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, chainOf, invalidCredentials, serverFault, wrap } from "@todo/fail/fail.ts";
import type { Log } from "../log.ts";
import { run } from "../run.ts";

/**
 * What sign-in needs from the identity store: the user and their password
 * credential by email, in one statement (`data/identity.md ›
 * credentials.find_for_sign_in`), and its writes, in one batch
 * (`data/identity.md › identity.sign_in`).
 */
export type SignInStore = {
  findForSignIn(email: string): Promise<Result<SignInCredential | null, AnyFail>>;
  recordSignIn(write: SignInWrite): Promise<Result<SignInWritten, AnyFail>>;
};

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

/**
 * What the request says about the device it came from (L51): its
 * `User-Agent` and its city, either of which may be absent. Display only:
 * the label is made from the one and the city stored as it is.
 */
export type Device = { userAgent: string | undefined; city: string | undefined };

/** The raw token, which only the caller ever holds, and the session's absolute expiry. */
export type SignedIn = { token: string; expiresAt: number };

export type SignInOperation = (actor: Actor, input: SignIn, device: Device, log: Log) => Promise<Result<SignedIn, AnyFail>>;

/** One refusal for every way the email and password fail to prove an account (threats row 7). */
const refused = () => err(invalidCredentials("the email and password do not match an account"));

/**
 * Proves an email and password belong to an account and starts a new
 * `cookie` session (L49). An unknown email is checked against the dummy
 * hash, so every refusal costs one Argon2id run and none says which it
 * was. The session the request presented, if any, is ended in the same
 * batch, as is a due rehash. A rehash the hasher cannot make is deferred,
 * not a failure: the password was proved against a hash that still holds,
 * the fault goes to the request's `log`, and the next sign-in tries again,
 * since the stored hash still needs it. Its scope is `n/a`, so the runner hands it
 * the actor: its session is the one presented.
 *
 * `newToken` gives 32 random bytes as base64url; `digest` is the hash the
 * store keeps instead (L40).
 *
 * Use case: `prd/todo/use-cases/auth/sign-in.md`
 */
export const signIn = (deps: {
  identityStore: SignInStore;
  hasher: Hasher;
  digest: (token: string) => Promise<string>;
  newId: () => string;
  newToken: () => string;
  now: () => number;
}): SignInOperation =>
  run("signIn", async (actor, input, device, log) => {
    const found = await deps.identityStore.findForSignIn(input.email);
    if (!found.ok) {
      return err(wrap(found.error, "sign in"));
    }
    const row = found.value;

    // Checked whatever was found, so the cost does not say what was.
    const matched = await deps.hasher.verify(input.password, row?.credential ?? DUMMY_PASSWORD_HASH);
    if (!matched.ok) {
      return err(wrap(matched.error, "sign in"));
    }
    if (row === null || !matched.value || row.user.disabled) {
      return refused();
    }

    let rehash: Rehash | undefined;
    if (deps.hasher.needsRehash(row.credential)) {
      const hashed = await deps.hasher.hash(input.password);
      if (hashed.ok) {
        rehash = { userId: row.user.id, ...hashed.value, previousSecret: row.credential.secret };
      } else {
        // Hygiene, not proof: deferring it loses nothing.
        const fault = wrap(hashed.error, "sign in: rehash deferred");
        log.error({ operation: "signIn", kind: fault.kind, message: fault.message, chain: chainOf(fault) });
      }
    }

    const now = deps.now();
    const token = deps.newToken();
    const session: NewSession = {
      id: deps.newId(),
      tokenHash: await deps.digest(token),
      userId: row.user.id,
      channel: "cookie",
      createdAt: now,
      idleUntil: now + SESSION_IDLE_MS,
      expiresAt: now + SESSION_ABSOLUTE_MS,
      label: deviceLabel(device.userAgent),
      city: device.city ?? null,
    };
    const write: SignInWrite = {
      session,
      ...(actor.kind === "user" ? { rotate: actor.sessionId } : {}),
      ...(rehash === undefined ? {} : { rehash }),
    };

    const written = await deps.identityStore.recordSignIn(write);
    if (!written.ok) {
      return err(wrap(written.error, "sign in"));
    }
    // A taken token hash means 256 random bits repeated: our fault, never
    // retried and never answered as a success with a token no row holds.
    if (!written.value.started) {
      return err(serverFault("sign in: the new session's token hash is already taken"));
    }
    // A rehash another sign-in landed first is not a failure: that one rehashed.
    return ok({ token, expiresAt: session.expiresAt });
  });
