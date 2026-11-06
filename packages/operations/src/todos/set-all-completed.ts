import type { Actor } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/**
 * What marking all needs from the store: "set `completed` on every todo of
 * the owner's", answered with each of them as it now is, in the order
 * they were added.
 */
export type SetAllCompletedStore = {
  setAllCompleted(scope: Own, completed: boolean): Promise<Result<readonly Todo[], AnyFail>>;
};

export type SetAllCompleted = (actor: Actor, completed: boolean) => Promise<Result<readonly Todo[], AnyFail>>;

/**
 * Sets `completed` on every one of the actor's todos to one value. It is
 * the value, not "flip it", so doing it twice is safe. No todos at all is
 * not a failure: the list comes back empty.
 *
 * Use case: `prd/todo/use-cases/todos/mark-all-completed.md`
 */
export const setAllCompleted =
  (deps: { dbStore: SetAllCompletedStore }): SetAllCompleted =>
  run("setAllCompleted", async (scope, completed) => {
    const set = await deps.dbStore.setAllCompleted(scope, completed);
    if (!set.ok) {
      return err(wrap(set.error, "set all completed"));
    }

    return ok(set.value);
  });
