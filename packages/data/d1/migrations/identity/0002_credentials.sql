-- Slice B (L48, L50, L51): what a user signs in with, and what a session
-- needs for sign-out and the Sessions page.

-- A user's credential of a kind: today only a password, as its Argon2id PHC
-- string, which carries its own parameters. `pepper_id` names the Workers
-- secret its HMAC was keyed with (L48). The password is never stored.
CREATE TABLE credentials (
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL CHECK (kind IN ('password')),
  secret TEXT NOT NULL,
  pepper_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind)
) STRICT;

-- Why a session ended (L40 named it; slice A's migration did not add it).
-- It is set exactly when `ended_at` is. Its values are not checked here, as
-- `channel` and `role` are: those are closed sets, and this one grows by
-- slice (C adds `password_changed`, D an admin end). SQLite cannot change a
-- CHECK in place, so a value-set CHECK would mean rebuilding `sessions` at
-- each. The `EndedReason` type holds the set, and only the identity store
-- writes the column.
ALTER TABLE sessions ADD COLUMN ended_reason TEXT
  CHECK ((ended_reason IS NULL) = (ended_at IS NULL));

-- When the session was last touched: last active reads it, never
-- `idle_until` minus the window (L51). SQLite adds a NOT NULL column only
-- with a default; every insert sets it, and the rows already there start
-- at their `created_at`.
ALTER TABLE sessions ADD COLUMN touched_at INTEGER NOT NULL DEFAULT 0;
UPDATE sessions SET touched_at = created_at;

-- What the Sessions page shows of a session, captured once when it starts:
-- a label from the User-Agent and a city. Display only, never checked.
ALTER TABLE sessions ADD COLUMN label TEXT;
ALTER TABLE sessions ADD COLUMN city TEXT;

-- Sign-out everywhere and the Sessions page find a user's sessions by it.
-- Without it each scanned the whole table (L40).
CREATE INDEX sessions_user_id ON sessions (user_id);
