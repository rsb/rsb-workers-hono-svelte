import { type Result, err, ok } from "@todo/business/result.ts";
import type { NewTodo } from "@todo/business/todos/todo.ts";
import { title } from "../fields/title.ts";
import type { Problems } from "../problem.ts";

/** What a delivery read for a new todo, not yet decoded or checked. */
export type NewTodoCandidate = { title: unknown };

/**
 * A new todo from what a delivery read: the title is text, trimmed, and 1 to
 * `TITLE_MAX` long. Gives every problem it finds.
 */
export const toNewTodo = (candidate: NewTodoCandidate): Result<NewTodo, Problems> => {
  const checked = title(candidate.title);
  if (!checked.ok) {
    return err([checked.error]);
  }

  return ok({ title: checked.value });
};
