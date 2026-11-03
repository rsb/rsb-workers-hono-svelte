import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";

/**
 * What clearing needs from the store: "delete every completed todo",
 * answered with the todos left, in the order they were added.
 */
export type DeleteCompletedStore = {
  deleteCompleted(): Promise<Result<readonly Todo[], AnyFail>>;
};

export type DeleteCompleted = () => Promise<Result<readonly Todo[], AnyFail>>;

/**
 * Deletes every completed todo and returns the todos left. No completed
 * todo is not a failure: the list comes back as it was.
 */
export const deleteCompleted =
  (deps: { dbStore: DeleteCompletedStore }): DeleteCompleted =>
  async () => {
    const deleted = await deps.dbStore.deleteCompleted();
    if (!deleted.ok) {
      return err(wrap(deleted.error, "delete completed"));
    }

    return ok(deleted.value);
  };
