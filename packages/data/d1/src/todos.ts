import { type Result, err, ok } from "@todo/business/result.ts";
import type { Own, Scope } from "@todo/business/auth/scope.ts";
import type { Todo, TodoCounts, TodoFilter, TodoPatch } from "@todo/business/todos/todo.ts";
import { type AnyFail, serverFault } from "@todo/fail/fail.ts";
import { execute, queryAll, writeThenQueryAll } from "./driver.ts";

/**
 * How a todo is read: SQLite has no boolean, so `completed` is 0 or 1. Its
 * owner, `user_id`, is the scope's, so no statement reads it back.
 */
export type Row = { id: string; title: string; completed: 0 | 1 };

/** The one row the counts statement returns. */
export type CountsRow = { active: number; completed: number };

export const toRow = (todo: Todo): Row => ({
  id: todo.id,
  title: todo.title,
  completed: todo.completed ? 1 : 0,
});

export const toTodo = (row: Row): Todo => ({
  id: row.id,
  title: row.title,
  completed: row.completed === 1,
});

// Stmt: the SQL and its binds, side by side, so each placeholder sits next
// to the value it takes. SQL is written by hand; every value is bound, never
// put in the text. Building a statement does no I/O.

/**
 * A scope as SQL (L43): for an owner, `user_id = ?n` with their id bound;
 * for every row, `TRUE`, which binds nothing. The text is one of the two
 * fixed terms, so no value is ever put in it, and the owner's term uses the
 * index on `user_id`. Its placeholder comes after the statement's own, so
 * dropping its bind leaves the others where they are.
 */
const inScope = (scope: Scope, n: number): { sql: string; binds: string[] } => {
  if ("ownerId" in scope) {
    return { sql: `user_id = ?${n}`, binds: [scope.ownerId] };
  }
  return { sql: "TRUE", binds: [] };
};

/**
 * One statement, so the count and the insert are one atomic step: SQLite
 * runs a statement as a whole, and D1 has no BEGIN to span two (DB1). The
 * cap is the owner's: only their rows are counted (`todos.cap`).
 */
const insertTodoUnlessFullStmt = (db: D1Database, scope: Own, row: Row, limit: number) => {
  const sql = `
    INSERT INTO todos (id, title, completed, user_id)
    SELECT ?1, ?2, ?3, ?4
    WHERE (SELECT COUNT(*) FROM todos WHERE user_id = ?4) < ?5`;
  return db.prepare(sql).bind(row.id, row.title, row.completed, scope.ownerId, limit);
};

const selectTodosStmt = (db: D1Database, scope: Scope) => {
  const where = inScope(scope, 1);
  const sql = `SELECT id, title, completed FROM todos WHERE ${where.sql} ORDER BY seq`;
  return db.prepare(sql).bind(...where.binds);
};

const selectTodosByCompletedStmt = (db: D1Database, scope: Scope, completed: Row["completed"]) => {
  const where = inScope(scope, 2);
  const sql = `SELECT id, title, completed FROM todos WHERE completed = ?1 AND ${where.sql} ORDER BY seq`;
  return db.prepare(sql).bind(completed, ...where.binds);
};

/** Both counts in one statement, so they are read together. `COUNT` gives 0 on an empty table. */
const countTodosStmt = (db: D1Database, scope: Scope) => {
  const where = inScope(scope, 1);
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE completed = 0) AS active,
      COUNT(*) FILTER (WHERE completed = 1) AS completed
    FROM todos
    WHERE ${where.sql}`;
  return db.prepare(sql).bind(...where.binds);
};

/**
 * One statement that updates and reads back, so the todo returned is the one
 * written. A column bound to `NULL` keeps its value: neither column can be
 * `NULL`, so `NULL` only ever means "not asked to change". A todo out of
 * scope is not matched, so it is neither changed nor returned: there is no
 * read before the write to race with (L43).
 */
const updateTodoStmt = (
  db: D1Database,
  scope: Scope,
  id: string,
  title: string | null,
  completed: Row["completed"] | null,
) => {
  const where = inScope(scope, 4);
  const sql = `
    UPDATE todos
    SET title = COALESCE(?2, title), completed = COALESCE(?3, completed)
    WHERE id = ?1 AND ${where.sql}
    RETURNING id, title, completed`;
  return db.prepare(sql).bind(id, title, completed, ...where.binds);
};

const setAllCompletedStmt = (db: D1Database, scope: Scope, completed: Row["completed"]) => {
  const where = inScope(scope, 2);
  const sql = `UPDATE todos SET completed = ?1 WHERE ${where.sql}`;
  return db.prepare(sql).bind(completed, ...where.binds);
};

/** As the update: a todo out of scope is not matched, so the change count says it was not deleted. */
const deleteTodoStmt = (db: D1Database, scope: Scope, id: string) => {
  const where = inScope(scope, 2);
  const sql = `DELETE FROM todos WHERE id = ?1 AND ${where.sql}`;
  return db.prepare(sql).bind(id, ...where.binds);
};

const deleteCompletedStmt = (db: D1Database, scope: Scope) => {
  const where = inScope(scope, 1);
  const sql = `DELETE FROM todos WHERE completed = 1 AND ${where.sql}`;
  return db.prepare(sql).bind(...where.binds);
};

// Raw: runs a statement and deals only in rows. A D1 error becomes the root
// failure here, named by what the statement does.

const insertTodoUnlessFullRaw = (db: D1Database, scope: Own, row: Row, limit: number) => {
  return execute(() => insertTodoUnlessFullStmt(db, scope, row, limit), "insert todo unless full");
};

const selectTodosRaw = (db: D1Database, scope: Scope) => {
  return queryAll<Row>(() => selectTodosStmt(db, scope), "select todos");
};

const selectTodosByCompletedRaw = (db: D1Database, scope: Scope, completed: Row["completed"]) => {
  return queryAll<Row>(() => selectTodosByCompletedStmt(db, scope, completed), "select todos by completed");
};

const countTodosRaw = (db: D1Database, scope: Scope) => {
  return queryAll<CountsRow>(() => countTodosStmt(db, scope), "count todos");
};

const updateTodoRaw = (
  db: D1Database,
  scope: Scope,
  id: string,
  title: string | null,
  completed: Row["completed"] | null,
) => {
  return queryAll<Row>(() => updateTodoStmt(db, scope, id, title, completed), "update todo");
};

/**
 * The update and the list as one batch, so the list returned is the one
 * written: D1 runs a batch as one transaction.
 */
const setAllCompletedRaw = (db: D1Database, scope: Scope, completed: Row["completed"]) => {
  return writeThenQueryAll<Row>(
    db,
    () => setAllCompletedStmt(db, scope, completed),
    () => selectTodosStmt(db, scope),
    "set all completed",
  );
};

const deleteTodoRaw = (db: D1Database, scope: Scope, id: string) => {
  return execute(() => deleteTodoStmt(db, scope, id), "delete todo");
};

/**
 * The delete and the list as one batch, so the list returned is what the
 * delete left: D1 runs a batch as one transaction.
 */
const deleteCompletedRaw = (db: D1Database, scope: Scope) => {
  return writeThenQueryAll<Row>(
    db,
    () => deleteCompletedStmt(db, scope),
    () => selectTodosStmt(db, scope),
    "delete completed",
  );
};

/**
 * Outer: the todo methods of the `DbStore`. They take and give business
 * objects and report facts; the operations decide what a fact means. A
 * failure from Raw goes up as it is, for the operation to wrap. Each takes
 * a scope first, and reads and writes only the rows in it (`todos.scoped`):
 * there is no default scope (L43).
 */
export const todoStore = (db: D1Database) => ({
  /** Whether the todo was inserted as the owner's. It is not when their list already holds `limit`. */
  addTodoUnlessFull: async (scope: Own, todo: Todo, limit: number): Promise<Result<boolean, AnyFail>> => {
    const row = toRow(todo);

    const changes = await insertTodoUnlessFullRaw(db, scope, row, limit);
    if (!changes.ok) {
      return err(changes.error);
    }

    const inserted = changes.value === 1;
    return ok(inserted);
  },

  /**
   * The todos the filter keeps, in the order they were added. Without
   * `completed` in the filter, every todo in scope.
   */
  listTodos: async (scope: Scope, filter: TodoFilter): Promise<Result<Todo[], AnyFail>> => {
    let rows: Result<Row[], AnyFail>;
    if (filter.completed === undefined) {
      rows = await selectTodosRaw(db, scope);
    } else {
      let flag: Row["completed"] = 0;
      if (filter.completed) {
        flag = 1;
      }
      rows = await selectTodosByCompletedRaw(db, scope, flag);
    }

    if (!rows.ok) {
      return err(rows.error);
    }

    const todos = rows.value.map(toTodo);
    return ok(todos);
  },

  /** How many todos are active and how many completed. */
  countTodos: async (scope: Scope): Promise<Result<TodoCounts, AnyFail>> => {
    const rows = await countTodosRaw(db, scope);
    if (!rows.ok) {
      return err(rows.error);
    }

    // An aggregate without GROUP BY always returns exactly one row.
    const [row] = rows.value;
    if (row === undefined) {
      return err(serverFault("count todos: no row came back"));
    }

    const counts = { active: row.active, completed: row.completed };
    return ok(counts);
  },

  /**
   * The todo after the patch is applied, or `null` when no todo in scope
   * has that id.
   * A field the patch leaves out is bound as `NULL`, which keeps its value.
   */
  updateTodo: async (scope: Scope, id: string, patch: TodoPatch): Promise<Result<Todo | null, AnyFail>> => {
    let title: string | null = null;
    if (patch.title !== undefined) {
      title = patch.title;
    }

    let flag: Row["completed"] | null = null;
    if (patch.completed === true) {
      flag = 1;
    }
    if (patch.completed === false) {
      flag = 0;
    }

    const rows = await updateTodoRaw(db, scope, id, title, flag);
    if (!rows.ok) {
      return err(rows.error);
    }

    // The id is unique, so the update returns one row or none.
    const [row] = rows.value;
    if (row === undefined) {
      return ok(null);
    }

    return ok(toTodo(row));
  },

  /** Every todo in scope after `completed` is set on all of them, in the order they were added. */
  setAllCompleted: async (scope: Scope, completed: boolean): Promise<Result<Todo[], AnyFail>> => {
    let flag: Row["completed"] = 0;
    if (completed) {
      flag = 1;
    }

    const rows = await setAllCompletedRaw(db, scope, flag);
    if (!rows.ok) {
      return err(rows.error);
    }

    const todos = rows.value.map(toTodo);
    return ok(todos);
  },

  /** Whether a todo was deleted. It is not when no todo in scope has that id. */
  deleteTodo: async (scope: Scope, id: string): Promise<Result<boolean, AnyFail>> => {
    const changes = await deleteTodoRaw(db, scope, id);
    if (!changes.ok) {
      return err(changes.error);
    }

    // The id is unique, so the delete changes one row or none.
    const deleted = changes.value === 1;
    return ok(deleted);
  },

  /** The todos left after every completed one is deleted, in the order they were added. */
  deleteCompleted: async (scope: Scope): Promise<Result<Todo[], AnyFail>> => {
    const rows = await deleteCompletedRaw(db, scope);
    if (!rows.ok) {
      return err(rows.error);
    }

    const todos = rows.value.map(toTodo);
    return ok(todos);
  },
});
