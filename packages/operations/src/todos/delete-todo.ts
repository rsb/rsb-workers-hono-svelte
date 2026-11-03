import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, notFound, wrap } from "@todo/fail/fail.ts";

/**
 * What deleting needs from the store: "delete this todo", answered with
 * whether a todo was deleted.
 */
export type DeleteStore = {
  deleteTodo(id: string): Promise<Result<boolean, AnyFail>>;
};

export type DeleteTodo = (id: string) => Promise<Result<string, AnyFail>>;

/**
 * Deletes one todo and returns its id.
 *
 * Use case: `prd/todo/use-cases/todos/remove-a-todo.md`
 */
export const deleteTodo =
  (deps: { dbStore: DeleteStore }): DeleteTodo =>
  async (id) => {
    const deleted = await deps.dbStore.deleteTodo(id);
    if (!deleted.ok) {
      return err(wrap(deleted.error, "delete todo"));
    }

    // The store only says no row was deleted; here that means not found.
    if (!deleted.value) {
      return err(notFound(`no todo has id ${id}`));
    }

    return ok(id);
  };
