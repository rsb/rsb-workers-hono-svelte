import type { Role } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import {
  type EndedReason,
  type ListedSession,
  type NewSession,
  SESSION_IDLE_MS,
  type SessionChannel,
  type SessionList,
  type SessionRow,
} from "@todo/business/auth/session.ts";
import { SESSIONS_LIST_MAX } from "@todo/business/rules.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { AnyFail } from "@todo/fail/fail.ts";
import { execute, queryAll } from "../driver.ts";

/** The row `sessions JOIN users` returns. The table's CHECKs hold `channel`, `role` and `disabled` to these values. */
export type FoundRow = {
  id: string;
  user_id: string;
  channel: SessionChannel;
  idle_until: number | null;
  expires_at: number;
  ended_at: number | null;
  role: Role;
  disabled: 0 | 1;
  email_verified_at: number | null;
  name: string;
  email: string;
};

/** The row as the `authenticate` gate reads it (`SessionRow`, in business). */
export const toSessionRow = (row: FoundRow): SessionRow => ({
  session: {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    idleUntil: row.idle_until,
    expiresAt: row.expires_at,
    endedAt: row.ended_at,
  },
  user: {
    role: row.role,
    disabled: row.disabled === 1,
    emailVerifiedAt: row.email_verified_at,
    name: row.name,
    email: row.email,
  },
});

/** A row `sessions.list` returns. */
type ListedRow = { id: string; label: string | null; city: string | null; created_at: number; touched_at: number };

const toListedSession = (row: ListedRow): ListedSession => ({
  id: row.id,
  label: row.label,
  city: row.city,
  createdAt: row.created_at,
  touchedAt: row.touched_at,
});

/**
 * Live, as the `authenticate` gate decides it, for a statement whose `?2`
 * is `now`: not ended, not past its absolute expiry, and inside its idle
 * window if it has one (`data/identity.md`).
 */
const LIVE = "ended_at IS NULL AND ?2 < expires_at AND (idle_until IS NULL OR ?2 < idle_until)";

// Stmt: the SQL and its binds, side by side.

/**
 * The session and its user in one statement, so they describe one moment.
 * D1 sends it to the primary: the store never opens a D1 session, so no
 * read goes to a replica (L40).
 */
const selectSessionByTokenHashStmt = (db: D1Database, tokenHash: string) => {
  const sql = `
    SELECT
      s.id, s.user_id, s.channel, s.idle_until, s.expires_at, s.ended_at,
      u.role, u.disabled, u.email_verified_at, u.name, u.email
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?1`;
  return db.prepare(sql).bind(tokenHash);
};

/**
 * Moves the idle window only while the session is open and its window ends
 * before `?3`, so of two touches that race only the first moves it, and an
 * ended session is never touched back to life (threats row 10). It records
 * the touch as last active (L51).
 */
const touchSessionStmt = (db: D1Database, id: string, idleUntil: number, before: number, now: number) => {
  const sql = `
    UPDATE sessions
    SET idle_until = ?2, touched_at = ?4
    WHERE id = ?1 AND ended_at IS NULL AND idle_until < ?3`;
  return db.prepare(sql).bind(id, idleUntil, before, now);
};

/**
 * A token hash already taken is skipped, not an error; any other conflict
 * is. `touched_at` starts at `created_at`. Only `identity.sign_in`'s batch
 * runs it, so it is exported to that file and has no method of its own.
 */
export const insertSessionStmt = (db: D1Database, session: NewSession) => {
  const sql = `
    INSERT INTO sessions (id, token_hash, user_id, channel, created_at, idle_until, expires_at, label, city, touched_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?5)
    ON CONFLICT (token_hash) DO NOTHING`;
  return db
    .prepare(sql)
    .bind(
      session.id,
      session.tokenHash,
      session.userId,
      session.channel,
      session.createdAt,
      session.idleUntil,
      session.expiresAt,
      session.label,
      session.city,
    );
};

/** Ends a session still open: of two ends that race, one ends it. */
export const endSessionStmt = (db: D1Database, id: string, reason: EndedReason, now: number) => {
  const sql = `
    UPDATE sessions
    SET ended_at = ?3, ended_reason = ?2
    WHERE id = ?1 AND ended_at IS NULL`;
  return db.prepare(sql).bind(id, reason, now);
};

/** The same, only for a session of the owner's: another's is left as it is. */
const endOwnSessionStmt = (db: D1Database, scope: Own, id: string, reason: EndedReason, now: number) => {
  const sql = `
    UPDATE sessions
    SET ended_at = ?3, ended_reason = ?2
    WHERE id = ?1 AND user_id = ?4 AND ended_at IS NULL`;
  return db.prepare(sql).bind(id, reason, now, scope.ownerId);
};

/** Every live session of the owner's, in one statement, so they end together. */
const endAllSessionsStmt = (db: D1Database, scope: Own, reason: EndedReason, now: number) => {
  const sql = `
    UPDATE sessions
    SET ended_at = ?2, ended_reason = ?3
    WHERE user_id = ?1 AND ${LIVE}`;
  return db.prepare(sql).bind(scope.ownerId, now, reason);
};

/** One more than the bound, so whether any were left out costs no second read. */
const selectLiveSessionsStmt = (db: D1Database, scope: Own, now: number) => {
  const sql = `
    SELECT id, label, city, created_at, touched_at
    FROM sessions
    WHERE user_id = ?1 AND ${LIVE}
    ORDER BY touched_at DESC, id
    LIMIT ?3`;
  return db.prepare(sql).bind(scope.ownerId, now, SESSIONS_LIST_MAX + 1);
};

// Raw: runs a statement and deals only in rows.

const selectSessionByTokenHashRaw = (db: D1Database, tokenHash: string) => {
  return queryAll<FoundRow>(() => selectSessionByTokenHashStmt(db, tokenHash), "select session by token hash");
};

const touchSessionRaw = (db: D1Database, id: string, idleUntil: number, before: number, now: number) => {
  return execute(() => touchSessionStmt(db, id, idleUntil, before, now), "touch session");
};

const endOwnSessionRaw = (db: D1Database, scope: Own, id: string, reason: EndedReason, now: number) => {
  return execute(() => endOwnSessionStmt(db, scope, id, reason, now), "end session");
};

const endAllSessionsRaw = (db: D1Database, scope: Own, reason: EndedReason, now: number) => {
  return execute(() => endAllSessionsStmt(db, scope, reason, now), "end all sessions");
};

const selectLiveSessionsRaw = (db: D1Database, scope: Own, now: number) => {
  return queryAll<ListedRow>(() => selectLiveSessionsStmt(db, scope, now), "select live sessions");
};

/**
 * Outer: the session methods of the identity store (`data/identity.md`).
 * The gate's two find a session by its credential or its key, before there
 * is an actor, and take no scope; the Sessions page's three take the
 * actor's (L51).
 */
export const sessionStore = (db: D1Database) => ({
  /** The session a token hash names, with its user, or `null` (`sessions.find`). */
  findSession: async (tokenHash: string): Promise<Result<SessionRow | null, AnyFail>> => {
    const rows = await selectSessionByTokenHashRaw(db, tokenHash);
    if (!rows.ok) {
      return err(rows.error);
    }

    // `token_hash` is UNIQUE, so there is at most one row.
    const [row] = rows.value;
    if (row === undefined) {
      return ok(null);
    }
    return ok(toSessionRow(row));
  },

  /**
   * Whether the session's idle window moved to `idleUntil` (`sessions.touch`).
   * It is skipped once the session has ended, or once another touch has
   * moved the window past `now` plus half the idle window.
   */
  touchSession: async (input: { id: string; idleUntil: number; now: number }): Promise<Result<boolean, AnyFail>> => {
    const before = input.now + SESSION_IDLE_MS / 2;

    const changes = await touchSessionRaw(db, input.id, input.idleUntil, before, input.now);
    if (!changes.ok) {
      return err(changes.error);
    }
    return ok(changes.value === 1);
  },

  /**
   * Whether one of the owner's sessions was ended (`sessions.end`): it is
   * not when it had already ended or is not the owner's.
   */
  endSession: async (
    scope: Own,
    input: { id: string; reason: EndedReason; now: number },
  ): Promise<Result<boolean, AnyFail>> => {
    const changes = await endOwnSessionRaw(db, scope, input.id, input.reason, input.now);
    if (!changes.ok) {
      return err(changes.error);
    }
    return ok(changes.value === 1);
  },

  /** How many of the owner's live sessions were ended (`sessions.end_all`). */
  endAllSessions: async (scope: Own, input: { reason: EndedReason; now: number }): Promise<Result<number, AnyFail>> => {
    return endAllSessionsRaw(db, scope, input.reason, input.now);
  },

  /** The owner's live sessions, most recently touched first, up to the bound (`sessions.list`). */
  listSessions: async (scope: Own, input: { now: number }): Promise<Result<SessionList, AnyFail>> => {
    const rows = await selectLiveSessionsRaw(db, scope, input.now);
    if (!rows.ok) {
      return err(rows.error);
    }

    const more = rows.value.length > SESSIONS_LIST_MAX;
    const sessions = rows.value.slice(0, SESSIONS_LIST_MAX).map(toListedSession);
    return ok({ sessions, more });
  },
});
