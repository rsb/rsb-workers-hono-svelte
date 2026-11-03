import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo, TodoFilter } from "@todo/business/todos/todo.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";

/** What listing needs from the store: the todos the filter keeps, in the order they were added. */
export type ListStore = {
  listTodos(filter: TodoFilter): Promise<Result<readonly Todo[], AnyFail>>;
};

export type ListTodos = (filter: TodoFilter) => Promise<Result<readonly Todo[], AnyFail>>;

/**
 * Lists the todos the filter keeps, in creation order; an empty filter keeps
 * every todo. No business rule refuses it; the store can still fail.
 */
export const listTodos =
  (deps: { dbStore: ListStore }): ListTodos =>
  async (filter) => {
    const listed = await deps.dbStore.listTodos(filter);
    if (!listed.ok) {
      return err(wrap(listed.error, "list todos"));
    }

    return ok(listed.value);
  };
