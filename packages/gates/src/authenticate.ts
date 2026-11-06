import { type Actor, type Profile, anonymous } from "@todo/business/auth/actor.ts";
import { SESSION_IDLE_MS, type SessionChannel, type SessionRow, TOKEN_PATTERN } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";

/**
 * What the gate needs from the identity store: the session a token hash
 * names, with its user, in one statement (`data/identity.md › sessions.find`).
 */
export type SessionLookup = {
  findSession(tokenHash: string): Promise<Result<SessionRow | null, AnyFail>>;
};

/** The credentials a request carries, as the binding read them. Either may be absent. */
export type Credentials = { cookie: string | undefined; bearer: string | undefined };

/** A credential that proves nothing, where the caller must be told (L39). */
export type Unauthenticated = { kind: "unauthenticated"; message: string };

/** A live session whose user is disabled (L39, L41). */
export type AccountDisabled = { kind: "account_disabled"; message: string };

/**
 * What the gate attaches. `clearCookie` asks the BFF to delete the session
 * cookie, which named no live session; the api never writes `Set-Cookie`
 * (L40). `refreshDue` says which session to touch and to when, after the
 * response; it is set at most once per half idle window.
 */
export type Authenticated = {
  actor: Actor;
  profile: Profile | undefined;
  clearCookie: boolean;
  refreshDue: { sessionId: string; idleUntil: number } | undefined;
};

export type Authenticate = (
  input: { credentials: Credentials; now: number },
) => Promise<Result<Authenticated, Unauthenticated | AccountDisabled | AnyFail>>;

const asAnonymous = (clearCookie: boolean): Authenticated => ({
  actor: anonymous,
  profile: undefined,
  clearCookie,
  refreshDue: undefined,
});

const isLive = (row: SessionRow, now: number) => {
  const { session } = row;
  if (session.endedAt !== null || now >= session.expiresAt) {
    return false;
  }
  return session.idleUntil === null || now < session.idleUntil;
};

/**
 * The `authenticate` gate's unit (L39): who a request acts for, from its
 * credential. It reads and never writes.
 *
 * - No credential: `anonymous`.
 * - A cookie that names no live session (unparseable, unknown, ended,
 *   expired, or a bearer session's token): `anonymous`, and the cookie is
 *   cleared. Two tabs racing a sign-out end at the signed-out page, not an
 *   error.
 * - A bearer token that names no live session: refused, `unauthenticated`.
 * - Both a cookie and a bearer token: refused, `unauthenticated`; a request
 *   proves itself one way.
 * - A live session whose user is disabled: refused, `account_disabled`.
 *
 * `digest` turns a raw token into the hash the store keeps (SHA-256, hex);
 * the delivery supplies it, so this package needs no platform crypto.
 */
export const authenticate =
  (deps: { sessions: SessionLookup; digest: (token: string) => Promise<string> }): Authenticate =>
  async ({ credentials, now }) => {
    const { cookie, bearer } = credentials;
    if (cookie !== undefined && bearer !== undefined) {
      return err({ kind: "unauthenticated", message: "a request gives a cookie or a bearer token, not both" });
    }
    if (cookie === undefined && bearer === undefined) {
      return ok(asAnonymous(false));
    }
    const channel: SessionChannel = cookie !== undefined ? "cookie" : "bearer";
    const token = cookie ?? bearer ?? "";

    // What names no live session: anonymous for a cookie, a refusal for a bearer.
    const noSession = (why: string): Result<Authenticated, Unauthenticated> =>
      channel === "cookie" ? ok(asAnonymous(true)) : err({ kind: "unauthenticated", message: why });

    if (!TOKEN_PATTERN.test(token)) {
      return noSession("the bearer token is not a token");
    }
    const found = await deps.sessions.findSession(await deps.digest(token));
    if (!found.ok) {
      return err(wrap(found.error, "authenticate"));
    }
    const row = found.value;
    // A token is accepted only on the channel its session was started for (L40).
    if (row === null || row.session.channel !== channel || !isLive(row, now)) {
      return noSession("the bearer token names no live session");
    }
    if (row.user.disabled) {
      return err({ kind: "account_disabled", message: "the account is disabled" });
    }

    const { session, user } = row;
    const actor: Actor = {
      kind: "user",
      userId: session.userId,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
    // A cookie session is touched once less than half its idle window is
    // left, never past its absolute expiry; a bearer session has no window.
    // Near the expiry the window cannot move, so nothing is due.
    const idleUntil = Math.min(now + SESSION_IDLE_MS, session.expiresAt);
    const due =
      session.idleUntil !== null && session.idleUntil - now < SESSION_IDLE_MS / 2 && idleUntil > session.idleUntil;
    const refreshDue = due ? { sessionId: session.id, idleUntil } : undefined;
    return ok({ actor, profile: { name: user.name, email: user.email }, clearCookie: false, refreshDue });
  };
