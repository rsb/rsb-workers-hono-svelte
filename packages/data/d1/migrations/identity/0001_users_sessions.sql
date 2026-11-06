-- The identity database (L42): who the users are and which sessions they
-- hold. The app database keeps only a user's id, never a join to here.
-- Times are milliseconds since the epoch, as integers.

-- A user's id is minted once, by the id source, when the user is created
-- (D13). The email is stored lower-cased, so UNIQUE decides on one spelling.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL
) STRICT;

-- A session holds the SHA-256 hash of its token, never the token (L40). A
-- bearer session has no idle window, and a cookie session always has one.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users (id),
  channel TEXT NOT NULL CHECK (channel IN ('cookie', 'bearer')),
  created_at INTEGER NOT NULL,
  idle_until INTEGER,
  expires_at INTEGER NOT NULL,
  ended_at INTEGER,
  CHECK ((channel = 'bearer') = (idle_until IS NULL))
) STRICT;
