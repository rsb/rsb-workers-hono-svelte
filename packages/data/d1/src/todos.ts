import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import type { AnyFail } from "@todo/fail/fail.ts";
import { execute, queryAll } from "./driver.ts";

/** How a todo is stored: SQLite has no boolean, so `completed` is 0 or 1. */
export type Row = { id: string; title: string; completed: 0 | 1 };

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
 * One statement, so the count and the insert are one atomic step: SQLite
 * runs a statement as a whole, and D1 has no BEGIN to span two (DB1).
 */
const insertTodoUnlessFullStmt = (db: D1Database, row: Row, limit: number) => {
  const sql = `
    INSERT INTO todos (id, title, completed)
    SELECT ?1, ?2, ?3
    WHERE (SELECT COUNT(*) FROM todos) < ?4`;
  return db.prepare(sql).bind(row.id, row.title, row.completed, limit);
};

const selectTodosStmt = (db: D1Database) => {
  const sql = "SELECT id, title, completed FROM todos ORDER BY seq";
  return db.prepare(sql);
};

// Raw: runs a statement and deals only in rows. A D1 error becomes the root
// failure here, named by what the statement does.

const insertTodoUnlessFullRaw = (db: D1Database, row: Row, limit: number) => {
  return execute(() => insertTodoUnlessFullStmt(db, row, limit), "insert todo unless full");
};

const selectTodosRaw = (db: D1Database) => {
  return queryAll<Row>(() => selectTodosStmt(db), "select todos");
};

/**
 * Outer: the todo methods of the `DbStore`. They take and give business
 * objects and report facts; the operations decide what a fact means. A
 * failure from Raw goes up as it is, for the operation to wrap.
 */
export const todoStore = (db: D1Database) => ({
  /** Whether the todo was inserted. It is not when the list already holds `limit`. */
  addTodoUnlessFull: async (todo: Todo, limit: number): Promise<Result<boolean, AnyFail>> => {
    const row = toRow(todo);

    const changes = await insertTodoUnlessFullRaw(db, row, limit);
    if (!changes.ok) {
      return err(changes.error);
    }

    const inserted = changes.value === 1;
    return ok(inserted);
  },

  /** Every todo, in the order they were added. */
  listTodos: async (): Promise<Result<Todo[], AnyFail>> => {
    const rows = await selectTodosRaw(db);
    if (!rows.ok) {
      return err(rows.error);
    }

    const todos = rows.value.map(toTodo);
    return ok(todos);
  },
});
