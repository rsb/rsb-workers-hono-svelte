import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import { type AnyFail, notFound, wrap } from "@todo/fail/fail.ts";

/**
 * What toggling needs from the store: "set this todo's `completed`",
 * answered with the todo as it now is, or `null` when no todo has that id.
 */
export type ToggleStore = {
  setCompleted(id: string, completed: boolean): Promise<Result<Todo | null, AnyFail>>;
};

export type ToggleTodo = (id: string, completed: boolean) => Promise<Result<Todo, AnyFail>>;

/** Marks one todo completed or active. Setting the value it already has is not a failure. */
export const toggleTodo =
  (deps: { dbStore: ToggleStore }): ToggleTodo =>
  async (id, completed) => {
    const updated = await deps.dbStore.setCompleted(id, completed);
    if (!updated.ok) {
      return err(wrap(updated.error, "toggle todo"));
    }

    // The store only says there was no such row; here that means not found.
    if (updated.value === null) {
      return err(notFound(`no todo has id ${id}`));
    }

    return ok(updated.value);
  };
