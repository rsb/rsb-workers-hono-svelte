import { type Result, err, ok } from "@todo/business/result.ts";
import type { TodoPatch } from "@todo/business/todos/todo.ts";
import { flag } from "../fields/decode.ts";
import { title } from "../fields/title.ts";
import type { Problem, Problems } from "../problem.ts";

/**
 * What a delivery read for a change to a todo, not yet decoded or checked.
 * A field left undefined is not asked to change.
 */
export type TodoPatchCandidate = { title?: unknown; completed?: unknown };

/**
 * A patch from what a delivery read: a title, a `completed`, or both. A
 * title follows the title rules; `completed` is a boolean. A patch with
 * neither is `patch.empty`. Gives every problem it finds.
 */
export const toTodoPatch = (candidate: TodoPatchCandidate): Result<TodoPatch, Problems> => {
  const hasTitle = candidate.title !== undefined;
  const hasCompleted = candidate.completed !== undefined;
  if (!hasTitle && !hasCompleted) {
    return err([{ rule: "patch.empty" }]);
  }

  const patch: TodoPatch = {};
  const problems: Problem[] = [];

  if (hasTitle) {
    const checked = title(candidate.title);
    if (checked.ok) {
      patch.title = checked.value;
    } else {
      problems.push(checked.error);
    }
  }

  if (hasCompleted) {
    const decoded = flag("completed", candidate.completed);
    if (decoded.ok) {
      patch.completed = decoded.value;
    } else {
      problems.push(decoded.error);
    }
  }

  const [first, ...rest] = problems;
  if (first !== undefined) {
    return err([first, ...rest]);
  }

  return ok(patch);
};
