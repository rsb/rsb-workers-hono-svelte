import type { Todo } from "@todo/business/todos/todo.ts";

/** How a todo is held: the id is the key, so the row keeps the rest. */
type Row = { title: string; completed: boolean };

/**
 * Todos in the isolate's memory. A `Map` iterates in insertion order, so
 * `list` returns todos in the order they were added. Todos are copied in
 * and out, so no caller can change what is stored.
 *
 * The methods are async to fit the ports, but no body awaits, so the check
 * and the set in `addUnlessFull` run in one go: no other request can run
 * between them.
 */
export const memoryTodos = () => {
  const rows = new Map<string, Row>();
  return {
    addUnlessFull: async (todo: Todo, limit: number): Promise<"added" | "full"> => {
      if (rows.size >= limit) return "full";
      rows.set(todo.id, { title: todo.title, completed: todo.completed });
      return "added";
    },
    list: async (): Promise<Todo[]> => [...rows].map(([id, row]) => ({ id, ...row })),
  };
};
