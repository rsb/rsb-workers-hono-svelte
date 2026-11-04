import { type Result, err, ok } from "@todo/business/result.ts";
import { TODO_LIMIT } from "@todo/business/rules.ts";
import { type NewTodo, type Todo, newTodo } from "@todo/business/todos/todo.ts";
import { type AnyFail, limitReached, wrap } from "@todo/fail/fail.ts";

/**
 * What adding needs from the store: "add this todo unless the list already
 * holds `limit`", answered with whether it was added. The check and the add
 * are one atomic step behind the port, so no other add can land between
 * them (deviation 9).
 */
export type AddStore = {
  addTodoUnlessFull(todo: Todo, limit: number): Promise<Result<boolean, AnyFail>>;
};

export type AddTodo = (input: NewTodo) => Promise<Result<Todo, AnyFail>>;

/**
 * Adds a validated new todo to the end of the list, unless the list is full.
 *
 * Use case: `prd/todo/use-cases/todos/add-a-todo.md`
 */
export const addTodo =
  (deps: { dbStore: AddStore; newId: () => string }): AddTodo =>
  async (input) => {
    const todo = newTodo(deps.newId(), input);

    const inserted = await deps.dbStore.addTodoUnlessFull(todo, TODO_LIMIT);
    if (!inserted.ok) {
      return err(wrap(inserted.error, "add todo"));
    }

    // The store only says it did not insert; here that means the list is full.
    if (!inserted.value) {
      return err(limitReached("the list is full"));
    }

    return ok(todo);
  };
