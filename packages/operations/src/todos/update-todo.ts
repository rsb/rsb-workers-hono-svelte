import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo, TodoPatch } from "@todo/business/todos/todo.ts";
import { type AnyFail, notFound, wrap } from "@todo/fail/fail.ts";

/**
 * What updating needs from the store: "apply this patch to this todo",
 * answered with the todo as it now is, or `null` when no todo has that id.
 */
export type UpdateStore = {
  updateTodo(id: string, patch: TodoPatch): Promise<Result<Todo | null, AnyFail>>;
};

export type UpdateTodo = (id: string, patch: TodoPatch) => Promise<Result<Todo, AnyFail>>;

/**
 * Changes one todo's title, its `completed`, or both, in one write. Setting
 * a value it already has is not a failure.
 *
 * Use case: `prd/todo/use-cases/todos/change-a-todo.md`
 */
export const updateTodo =
  (deps: { dbStore: UpdateStore }): UpdateTodo =>
  async (id, patch) => {
    const updated = await deps.dbStore.updateTodo(id, patch);
    if (!updated.ok) {
      return err(wrap(updated.error, "update todo"));
    }

    // The store only says there was no such row; here that means not found.
    if (updated.value === null) {
      return err(notFound(`no todo has id ${id}`));
    }

    return ok(updated.value);
  };
