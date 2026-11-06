-- Every todo belongs to one user (PRD deviation 21, L43): `user_id` is the
-- owner's id in the identity database. That is another database, so there
-- is no foreign key; the store's scope keeps a row to its owner (L42).
--
-- This drops every todo. SQLite cannot add a NOT NULL column without a
-- default, and no default is honest: a todo stored before owners has no
-- owner to give it. So the table is rebuilt, not altered. There is no
-- deployed data to keep: only local dev and test databases hold todos.
DROP TABLE todos;

-- As 0001 made it, with the owner. `seq` is still the rowid, so ORDER BY
-- seq is insertion order (DB6).
CREATE TABLE todos (
  seq INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL CHECK (completed IN (0, 1))
) STRICT;

-- Every call is scoped to an owner. An index keeps the rowid after its
-- key, so it holds an owner's rows in `seq` order: a scoped list reads
-- only that owner's rows, in order, with no sort.
CREATE INDEX todos_user_id ON todos (user_id);
