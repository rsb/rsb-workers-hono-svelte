import type { Actor } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { TodoCounts } from "@todo/business/todos/todo.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/**
 * What counting needs from the store: how many of the owner's todos are
 * active and how many completed.
 */
export type CountStore = {
  countTodos(scope: Own): Promise<Result<TodoCounts, AnyFail>>;
};

export type CountTodos = (actor: Actor) => Promise<Result<TodoCounts, AnyFail>>;

/**
 * Counts every one of the actor's todos, active and completed. No business
 * rule refuses it; the store can still fail.
 *
 * Use case: `prd/todo/use-cases/todos/count-todos.md`
 */
export const countTodos =
  (deps: { dbStore: CountStore }): CountTodos =>
  run("countTodos", async (scope) => {
    const counted = await deps.dbStore.countTodos(scope);
    if (!counted.ok) {
      return err(wrap(counted.error, "count todos"));
    }

    return ok(counted.value);
  });
