import type { Todo } from "@todo/business/todos/todo.ts";

/** How a todo is held: the id is the key, so the row keeps the rest. */
type Row = { title: string; completed: boolean };

/**
 * Todos in the isolate's memory. A `Map` iterates in insertion order, so
 * `list` returns todos in the order they were added. Todos are copied in
 * and out, so no caller can change what is stored.
 */
export const memoryTodos = () => {
  const rows = new Map<string, Row>();
  return {
    count: (): number => rows.size,
    add: (todo: Todo): void => {
      rows.set(todo.id, { title: todo.title, completed: todo.completed });
    },
    list: (): Todo[] => [...rows].map(([id, row]) => ({ id, ...row })),
  };
};
