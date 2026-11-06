/**
 * What someone signs in with (L47, L49). The email was trimmed and
 * lower-cased by its validator; the password is exactly as it was typed.
 */
export type SignIn = { email: string; password: string };
