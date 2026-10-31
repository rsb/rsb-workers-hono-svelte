import { type Result, err, ok } from "@todo/business/result.ts";
import { TODO_LIMIT, type Todo, newTodo } from "@todo/business/todos/todo.ts";

/**
 * What adding needs from a store: one intent, "add this todo unless the list
 * already holds `limit`". The check and the add are one atomic step behind
 * the port, so no other add can land between them (deviation 9).
 */
export type AddStore = {
  addUnlessFull(todo: Todo, limit: number): Promise<"added" | "full">;
};

export type AddTodo = (title: string) => Promise<Result<Todo, { kind: "full" }>>;

/** Adds a todo with a valid title to the end of the list, unless the list is full. */
export const addTodo =
  (deps: { store: AddStore; newId: () => string }): AddTodo =>
  async (title) => {
    const todo = newTodo(deps.newId(), title);
    const added = await deps.store.addUnlessFull(todo, TODO_LIMIT);
    return added === "full" ? err({ kind: "full" }) : ok(todo);
  };
