import type { Role } from "@todo/business/auth/actor.ts";
import { SESSION_IDLE_MS, type SessionChannel, type SessionRow } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { AnyFail } from "@todo/fail/fail.ts";
import { execute, queryAll } from "../driver.ts";

/** A new session, as `sessions.start` takes it: the token's hash, never the token (L40). */
export type NewSession = {
  id: string;
  tokenHash: string;
  userId: string;
  channel: SessionChannel;
  createdAt: number;
  idleUntil: number | null;
  expiresAt: number;
};

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
 * before `?3`, so of two touches that race only the first moves it.
 */
const touchSessionStmt = (db: D1Database, id: string, idleUntil: number, before: number) => {
  const sql = `
    UPDATE sessions
    SET idle_until = ?2
    WHERE id = ?1 AND ended_at IS NULL AND idle_until < ?3`;
  return db.prepare(sql).bind(id, idleUntil, before);
};

/** A token hash already taken is skipped, not an error; any other conflict is. */
const insertSessionStmt = (db: D1Database, session: NewSession) => {
  const sql = `
    INSERT INTO sessions (id, token_hash, user_id, channel, created_at, idle_until, expires_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
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
    );
};

// Raw: runs a statement and deals only in rows.

const selectSessionByTokenHashRaw = (db: D1Database, tokenHash: string) => {
  return queryAll<FoundRow>(() => selectSessionByTokenHashStmt(db, tokenHash), "select session by token hash");
};

const touchSessionRaw = (db: D1Database, id: string, idleUntil: number, before: number) => {
  return execute(() => touchSessionStmt(db, id, idleUntil, before), "touch session");
};

const insertSessionRaw = (db: D1Database, session: NewSession) => {
  return execute(() => insertSessionStmt(db, session), "insert session");
};

/**
 * Outer: the session methods of the identity store (`data/identity.md`).
 * None takes a scope: a session is found by its credential or its key,
 * before there is an actor to scope by.
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

    const changes = await touchSessionRaw(db, input.id, input.idleUntil, before);
    if (!changes.ok) {
      return err(changes.error);
    }
    return ok(changes.value === 1);
  },

  /** Whether the session was stored: it is not when its token hash is taken (`sessions.start`). */
  startSession: async (session: NewSession): Promise<Result<boolean, AnyFail>> => {
    const changes = await insertSessionRaw(db, session);
    if (!changes.ok) {
      return err(changes.error);
    }
    return ok(changes.value === 1);
  },
});
