import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";

/**
 * What marking all needs from the store: "set `completed` on every todo",
 * answered with every todo as it now is, in the order they were added.
 */
export type SetAllCompletedStore = {
  setAllCompleted(completed: boolean): Promise<Result<readonly Todo[], AnyFail>>;
};

export type SetAllCompleted = (completed: boolean) => Promise<Result<readonly Todo[], AnyFail>>;

/**
 * Sets every todo's `completed` to one value. It is the value, not "flip
 * it", so doing it twice is safe. No todos at all is not a failure: the
 * list comes back empty.
 *
 * Use case: `prd/todo/use-cases/todos/mark-all-completed.md`
 */
export const setAllCompleted =
  (deps: { dbStore: SetAllCompletedStore }): SetAllCompleted =>
  async (completed) => {
    const set = await deps.dbStore.setAllCompleted(completed);
    if (!set.ok) {
      return err(wrap(set.error, "set all completed"));
    }

    return ok(set.value);
  };
