import type { Role } from "./actor.ts";
import type { NewSession } from "./session.ts";

/**
 * What someone signs in with (L47, L49). The email was trimmed and
 * lower-cased by its validator; the password is exactly as it was typed.
 */
export type SignIn = { email: string; password: string };

/** What a credential is. Only a password today (L48). */
export type CredentialKind = "password";

/**
 * Argon2id's parameters for a new password hash (L48): OWASP's first
 * configuration, m=19456 KiB, t=2, p=1, with a 16-byte salt and a 32-byte
 * output. A stored hash at other parameters is rehashed at its next
 * sign-in. Raising them raises sign-in's CPU, which its budget states.
 */
export const ARGON2_PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1, hashLength: 32, saltLength: 16 } as const;

/**
 * The pepper a new hash is keyed with: the Workers secret `PEPPER_<id>`
 * (L48). A rotation adds the next id's secret and moves this on; a stored
 * hash under an older pepper is rehashed at its next sign-in.
 */
export const CURRENT_PEPPER_ID = 1;

/**
 * A stored password hash: the Argon2id PHC string, which carries its own
 * parameters and salt, and the id of the pepper its input was keyed with.
 */
export type PasswordHash = { secret: string; pepperId: number };

/**
 * What sign-in checks a password against when no user has the email (L49,
 * threats row 7): a PHC string at `ARGON2_PARAMS`, of a random input no
 * one kept, so the check costs what a real one does and never matches. Not
 * a secret. A change to `ARGON2_PARAMS` replaces it; a unit test holds the
 * two together.
 */
export const DUMMY_PASSWORD_HASH: PasswordHash = {
  secret: "$argon2id$v=19$m=19456,t=2,p=1$K06mhh3om0h4Gzr4aVVH3w$nYredE6DewNRu/oC/Lh/M56JNYaZAQm0wfJ1vlMdBKo",
  pepperId: CURRENT_PEPPER_ID,
};

/**
 * A user and their password credential, as one statement reads them
 * (`data/identity.md › credentials.find_for_sign_in`). The row is reported
 * as it is: whether it needs a rehash is the operation's to decide.
 */
export type SignInCredential = {
  user: { id: string; role: Role; disabled: boolean; emailVerifiedAt: number | null };
  credential: PasswordHash;
};

/**
 * A due rehash: the new PHC string and its pepper id, written only while
 * the credential still holds `previousSecret`, the string read before the
 * password was checked (L48).
 */
export type Rehash = { userId: string; secret: string; pepperId: number; previousSecret: string };

/**
 * A sign-in's writes (`data/identity.md › identity.sign_in`): the new
 * session; the session the request presented, to end as `rotated`; and a
 * due rehash. The rotation and the rehash happen at the session's
 * `createdAt`.
 */
export type SignInWrite = { session: NewSession; rotate?: string; rehash?: Rehash };

/** Whether the session was stored, and, with a rehash, whether it landed. */
export type SignInWritten = { started: boolean; rehashed?: boolean };
