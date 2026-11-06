-- Todos, in the order they were added. `seq` is the rowid: a new row gets
-- one more than the largest, so ORDER BY seq is insertion order (DB6). It
-- never leaves the data package. SQLite has no boolean, so `completed` is
-- 0 or 1 (DB7).
CREATE TABLE todos (
  seq INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL CHECK (completed IN (0, 1))
) STRICT;
