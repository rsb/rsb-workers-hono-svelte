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
 * A user and their password credential, as one statement reads them
 * (`data/identity.md › credentials.find_for_sign_in`). The row is reported
 * as it is: whether it needs a rehash is the operation's to decide.
 */
export type SignInCredential = {
  user: { id: string; role: Role; disabled: boolean; emailVerifiedAt: number | null };
  credential: { secret: string; pepperId: number };
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
