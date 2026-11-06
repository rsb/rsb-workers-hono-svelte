import type { Role } from "./actor.ts";

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

/**
 * A session and its user, as one statement reads them (`data/identity.md ›
 * sessions.find`): ended or expired included, since whether a session is
 * live is the `authenticate` gate's to decide. `idleUntil` is null for a
 * bearer session, which has no idle window (L40). Written once here, so the
 * gate's port and the store's result are the same type.
 */
export type SessionRow = {
  session: {
    id: string;
    userId: string;
    channel: SessionChannel;
    idleUntil: number | null;
    expiresAt: number;
    endedAt: number | null;
  };
  user: { role: Role; disabled: boolean; emailVerifiedAt: number | null; name: string; email: string };
};
