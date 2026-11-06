import type { Actor } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo, TodoPatch } from "@todo/business/todos/todo.ts";
import { type AnyFail, notFound, wrap } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/**
 * What updating needs from the store: "apply this patch to this todo if
 * it is the owner's", answered with the todo as it now is, or `null` when
 * none of the owner's has that id.
 */
export type UpdateStore = {
  updateTodo(scope: Own, id: string, patch: TodoPatch): Promise<Result<Todo | null, AnyFail>>;
};

export type UpdateTodo = (actor: Actor, id: string, patch: TodoPatch) => Promise<Result<Todo, AnyFail>>;

/**
 * Changes one of the actor's todos: its title, its `completed`, or both,
 * in one write. Setting a value it already has is not a failure.
 *
 * Use case: `prd/todo/use-cases/todos/change-a-todo.md`
 */
export const updateTodo =
  (deps: { dbStore: UpdateStore }): UpdateTodo =>
  run("updateTodo", async (scope, id, patch) => {
    const updated = await deps.dbStore.updateTodo(scope, id, patch);
    if (!updated.ok) {
      return err(wrap(updated.error, "update todo"));
    }

    // The store only says no row in scope has the id: none has it
    // (`todo.exists`), or another's has it (`todo.owned`). Both are not found.
    if (updated.value === null) {
      return err(notFound(`no todo has id ${id}`));
    }

    return ok(updated.value);
  });
