import type { Todo } from "@todo/business/todos/todo.ts";

/** What listing needs from a store: every todo, in the order they were added. */
export type ListStore = {
  list(): readonly Todo[];
};

export type ListTodos = () => readonly Todo[];

/** Lists every todo in creation order. It cannot fail. */
export const listTodos =
  (deps: { store: ListStore }): ListTodos =>
  () =>
    deps.store.list();
