import type { Role } from "@todo/business/auth/actor.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { AnyFail } from "@todo/fail/fail.ts";
import { execute, queryAll } from "../driver.ts";

/** A new user, as `users.create` takes them. The email is already lower-cased; the table refuses one that is not. */
export type NewUser = { id: string; email: string; name: string; role: Role; createdAt: number };

/** A user as `users.find_by_email` reports them. */
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabled: boolean;
  emailVerifiedAt: number | null;
  createdAt: number;
};

/** How a user is stored. The table's CHECKs hold `role` and `disabled` to these values. */
export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabled: 0 | 1;
  email_verified_at: number | null;
  created_at: number;
};

export const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  disabled: row.disabled === 1,
  emailVerifiedAt: row.email_verified_at,
  createdAt: row.created_at,
});

// Stmt: the SQL and its binds, side by side.

/** The UNIQUE index on `email` decides, so two creates of one email cannot both land. */
const insertUserStmt = (db: D1Database, user: NewUser) => {
  const sql = `
    INSERT INTO users (id, email, name, role, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT (email) DO NOTHING`;
  return db.prepare(sql).bind(user.id, user.email, user.name, user.role, user.createdAt);
};

/** Only an unverified user: the first verification's time is kept. */
const markVerifiedStmt = (db: D1Database, userId: string, now: number) => {
  const sql = `
    UPDATE users
    SET email_verified_at = ?2
    WHERE id = ?1 AND email_verified_at IS NULL`;
  return db.prepare(sql).bind(userId, now);
};

const selectUserByEmailStmt = (db: D1Database, email: string) => {
  const sql = `
    SELECT id, email, name, role, disabled, email_verified_at, created_at
    FROM users
    WHERE email = ?1`;
  return db.prepare(sql).bind(email);
};

// Raw: runs a statement and deals only in rows.

const insertUserRaw = (db: D1Database, user: NewUser) => {
  return execute(() => insertUserStmt(db, user), "insert user");
};

const markVerifiedRaw = (db: D1Database, userId: string, now: number) => {
  return execute(() => markVerifiedStmt(db, userId, now), "mark user verified");
};

const selectUserByEmailRaw = (db: D1Database, email: string) => {
  return queryAll<UserRow>(() => selectUserByEmailStmt(db, email), "select user by email");
};

/** Outer: the user methods of the identity store (`data/identity.md`). None takes a scope. */
export const userStore = (db: D1Database) => ({
  /** Whether the user was created: they are not when the email is taken (`users.create`). */
  createUser: async (user: NewUser): Promise<Result<boolean, AnyFail>> => {
    const changes = await insertUserRaw(db, user);
    if (!changes.ok) {
      return err(changes.error);
    }
    return ok(changes.value === 1);
  },

  /**
   * Whether the user was marked verified now: they are not when they were
   * already, or when no user has the id (`users.mark_verified`).
   */
  markVerified: async (userId: string, now: number): Promise<Result<boolean, AnyFail>> => {
    const changes = await markVerifiedRaw(db, userId, now);
    if (!changes.ok) {
      return err(changes.error);
    }
    return ok(changes.value === 1);
  },

  /** The user with an email, or `null` (`users.find_by_email`). */
  findUserByEmail: async (email: string): Promise<Result<User | null, AnyFail>> => {
    const rows = await selectUserByEmailRaw(db, email);
    if (!rows.ok) {
      return err(rows.error);
    }

    // `email` is UNIQUE, so there is at most one row.
    const [row] = rows.value;
    if (row === undefined) {
      return ok(null);
    }
    return ok(toUser(row));
  },
});
