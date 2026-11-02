import type { Todo } from "@todo/business/todos/todo.ts";

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

// SQL is written by hand, and every value is bound, never put in the text.

/**
 * One statement, so the count and the insert are one atomic step: SQLite
 * runs a statement as a whole, and D1 has no BEGIN to span two (DB1).
 */
const ADD_UNLESS_FULL = `
  INSERT INTO todos (id, title, completed)
  SELECT ?1, ?2, ?3
  WHERE (SELECT COUNT(*) FROM todos) < ?4`;

const LIST = "SELECT id, title, completed FROM todos ORDER BY seq";

/**
 * Todos in a D1 database, migrated by `migrations/`. Like every data package,
 * it does not name the operations' ports; construct checks that it fits them.
 */
export const d1Todos = (db: D1Database) => ({
  addUnlessFull: async (todo: Todo, limit: number): Promise<"added" | "full"> => {
    const row = toRow(todo);
    const { meta } = await db
      .prepare(ADD_UNLESS_FULL)
      .bind(row.id, row.title, row.completed, limit)
      .run();
    return meta.changes === 1 ? "added" : "full";
  },
  list: async (): Promise<Todo[]> => {
    const { results } = await db.prepare(LIST).all<Row>();
    return results.map(toTodo);
  },
});
