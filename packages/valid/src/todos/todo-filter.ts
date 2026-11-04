import { type Result, err, ok } from "@todo/business/result.ts";
import type { TodoFilter } from "@todo/business/todos/todo.ts";
import { flag } from "../fields/decode.ts";
import type { Problems } from "../problem.ts";

/**
 * What a delivery read for which todos to list, not yet decoded. No
 * `completed` lists every todo.
 */
export type TodoFilterCandidate = { completed?: unknown };

/** A filter from what a delivery read: `completed`, when given, is a boolean. */
export const toTodoFilter = (candidate: TodoFilterCandidate): Result<TodoFilter, Problems> => {
  if (candidate.completed === undefined) {
    return ok({});
  }

  const decoded = flag("completed", candidate.completed);
  if (!decoded.ok) {
    return err([decoded.error]);
  }

  return ok({ completed: decoded.value });
};
