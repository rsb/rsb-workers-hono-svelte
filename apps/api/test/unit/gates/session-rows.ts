import { SESSION_IDLE_MS, type SessionRow } from "@todo/business/auth/session.ts";
import { NOW } from "../test-api.ts";

const HOUR = 60 * 60 * 1000;

/** Raw tokens: 43 characters of base64url, as `TOKEN_PATTERN` asks. */
export const MEMBER_TOKEN = "m".repeat(43);
export const BEARER_TOKEN = "b".repeat(43);
export const DISABLED_TOKEN = "d".repeat(43);
export const STALE_TOKEN = "s".repeat(43);
export const UNKNOWN_TOKEN = "u".repeat(43);

const user = { role: "member", disabled: false, emailVerifiedAt: null, name: "Ada Lovelace", email: "ada@example.com" } as const;

const cookieSession = (id: string, idleUntil = NOW + 20 * HOUR) => ({
  id,
  userId: "u1",
  channel: "cookie" as const,
  idleUntil,
  expiresAt: NOW + 10 * 24 * HOUR,
  endedAt: null,
});

/** The rows the fake identity store knows, keyed by the test digest of each token. */
export const sessionRows: Record<string, SessionRow> = {
  [`hash:${MEMBER_TOKEN}`]: { session: cookieSession("s-member"), user },
  [`hash:${BEARER_TOKEN}`]: {
    session: { ...cookieSession("s-bearer"), channel: "bearer", idleUntil: null },
    user,
  },
  [`hash:${DISABLED_TOKEN}`]: { session: cookieSession("s-disabled"), user: { ...user, disabled: true } },
  // Less than half the idle window is left, so a touch is due.
  [`hash:${STALE_TOKEN}`]: { session: cookieSession("s-stale", NOW + SESSION_IDLE_MS / 4), user },
};
