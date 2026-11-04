// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import { type Result, err, ok } from "@todo/business/result.ts";
import type { TodoFilter } from "@todo/business/todos/todo.ts";
import { flag } from "../fields/decode.ts";
import type { Problems } from "../problem.ts";

/** What a delivery read for a `TodoFilter`, not yet decoded. */
export type TodoFilterCandidate = { completed?: unknown };

/**
 * A `TodoFilter` from what a delivery read. Which todos to list. No `completed`
 * lists every todo. Gives every problem it finds, as prd/todo/rules.md › Every
 * input says.
 */
export const toTodoFilter = (candidate: TodoFilterCandidate): Result<TodoFilter, Problems> => {
  const completed = candidate.completed === undefined ? undefined : flag("completed", candidate.completed);

  if (completed !== undefined && !completed.ok) {
    return err([completed.error]);
  }

  return ok({
    ...(completed === undefined ? {} : { completed: completed.value }),
  });
};
