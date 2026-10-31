import { type Result, err, ok } from "@todo/business/result.ts";
import { TODO_LIMIT, type Todo, newTodo } from "@todo/business/todos/todo.ts";

/** What adding needs from a store. Synchronous, so the cap check and the add cannot interleave. */
export type AddStore = {
  count(): number;
  add(todo: Todo): void;
};

export type AddTodo = (title: string) => Result<Todo, { kind: "full" }>;

/** Adds a todo with a valid title to the end of the list, unless the list is full. */
export const addTodo =
  (deps: { store: AddStore; newId: () => string }): AddTodo =>
  (title) => {
    if (deps.store.count() >= TODO_LIMIT) return err({ kind: "full" });
    const todo = newTodo(deps.newId(), title);
    deps.store.add(todo);
    return ok(todo);
  };
