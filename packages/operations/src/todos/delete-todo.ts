import type { Actor } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, notFound, wrap } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/**
 * What deleting needs from the store: "delete this todo if it is the
 * owner's", answered with whether a todo was deleted.
 */
export type DeleteStore = {
  deleteTodo(scope: Own, id: string): Promise<Result<boolean, AnyFail>>;
};

export type DeleteTodo = (actor: Actor, id: string) => Promise<Result<string, AnyFail>>;

/**
 * Deletes one of the actor's todos and returns its id.
 *
 * Use case: `prd/todo/use-cases/todos/remove-a-todo.md`
 */
export const deleteTodo =
  (deps: { dbStore: DeleteStore }): DeleteTodo =>
  run("deleteTodo", async (scope, id) => {
    const deleted = await deps.dbStore.deleteTodo(scope, id);
    if (!deleted.ok) {
      return err(wrap(deleted.error, "delete todo"));
    }

    // The store only says no row in scope was deleted: none has the id
    // (`todo.exists`), or another's has it (`todo.owned`). Both are not found.
    if (!deleted.value) {
      return err(notFound(`no todo has id ${id}`));
    }

    return ok(id);
  });
