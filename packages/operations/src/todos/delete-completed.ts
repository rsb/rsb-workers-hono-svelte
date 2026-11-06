import type { Actor } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/**
 * What clearing needs from the store: "delete every completed todo of
 * the owner's", answered with their todos left, in the order they were
 * added.
 */
export type DeleteCompletedStore = {
  deleteCompleted(scope: Own): Promise<Result<readonly Todo[], AnyFail>>;
};

export type DeleteCompleted = (actor: Actor) => Promise<Result<readonly Todo[], AnyFail>>;

/**
 * Deletes every completed todo of the actor's and returns their todos
 * left. No completed todo is not a failure: the list comes back as it was.
 *
 * Use case: `prd/todo/use-cases/todos/clear-completed.md`
 */
export const deleteCompleted =
  (deps: { dbStore: DeleteCompletedStore }): DeleteCompleted =>
  run("deleteCompleted", async (scope) => {
    const deleted = await deps.dbStore.deleteCompleted(scope);
    if (!deleted.ok) {
      return err(wrap(deleted.error, "delete completed"));
    }

    return ok(deleted.value);
  });
