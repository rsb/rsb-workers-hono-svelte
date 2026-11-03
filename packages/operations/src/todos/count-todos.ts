import { type Result, err, ok } from "@todo/business/result.ts";
import type { TodoCounts } from "@todo/business/todos/todo.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";

/** What counting needs from the store: how many todos are active and how many completed. */
export type CountStore = {
  countTodos(): Promise<Result<TodoCounts, AnyFail>>;
};

export type CountTodos = () => Promise<Result<TodoCounts, AnyFail>>;

/**
 * Counts every todo, active and completed. No business rule refuses it; the store can still fail.
 *
 * Use case: `prd/todo/use-cases/todos/count-todos.md`
 */
export const countTodos =
  (deps: { dbStore: CountStore }): CountTodos =>
  async () => {
    const counted = await deps.dbStore.countTodos();
    if (!counted.ok) {
      return err(wrap(counted.error, "count todos"));
    }

    return ok(counted.value);
  };
