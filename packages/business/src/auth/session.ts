/**
 * The session timeouts (L40), in milliseconds. A cookie session slides: each
 * request a day after the last keeps it alive, up to the absolute limit. A
 * bearer session has no idle window and a longer absolute one.
 */
export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
export const BEARER_ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;

/** How a credential reaches the api: the BFF's cookie, or a CLI's `Authorization: Bearer`. */
export type SessionChannel = "cookie" | "bearer";

/**
 * A raw session token: 32 random bytes, base64url without padding, so 43
 * characters. Anything else is not a token and names no session.
 */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
