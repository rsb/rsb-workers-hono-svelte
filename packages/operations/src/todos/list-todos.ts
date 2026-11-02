import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";

/** What listing needs from the store: every todo, in the order they were added. */
export type ListStore = {
  listTodos(): Promise<Result<readonly Todo[], AnyFail>>;
};

export type ListTodos = () => Promise<Result<readonly Todo[], AnyFail>>;

/** Lists every todo in creation order. No business rule refuses it; the store can still fail. */
export const listTodos =
  (deps: { dbStore: ListStore }): ListTodos =>
  async () => {
    const listed = await deps.dbStore.listTodos();
    if (!listed.ok) {
      return err(wrap(listed.error, "list todos"));
    }

    return ok(listed.value);
  };
