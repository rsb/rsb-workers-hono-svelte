// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import { type Result, err, ok } from "@todo/business/result.ts";
import type { TodoPatch } from "@todo/business/todos/todo.ts";
import { flag, text } from "../fields/decode.ts";
import { problemsFrom } from "../fields/problems.ts";
import type { Problem, Problems } from "../problem.ts";
import { patchNonempty } from "../rules/patch-nonempty.ts";
import { titleLength } from "../rules/title-length.ts";

/** `title`: text, trimmed, then `title.length`. */
const titleField = (value: unknown): Result<string, Problem> => {
  const decoded = text("title", value);
  if (!decoded.ok) {
    return decoded;
  }

  const applied = decoded.value.trim();
  const titleLengthProblem = titleLength("title", applied);
  if (titleLengthProblem !== undefined) {
    return err(titleLengthProblem);
  }

  return ok(applied);
};

/** What a delivery read for a `TodoPatch`, not yet decoded. */
export type TodoPatchCandidate = { title?: unknown; completed?: unknown };

/**
 * A `TodoPatch` from what a delivery read. What someone asks to change in a
 * todo. A field not given is not asked to change. Gives every problem it finds,
 * as prd/todo/rules.md › Every input says.
 */
export const toTodoPatch = (candidate: TodoPatchCandidate): Result<TodoPatch, Problems> => {
  const patchNonemptyProblem = patchNonempty(candidate);
  if (patchNonemptyProblem !== undefined) {
    return err([patchNonemptyProblem]);
  }

  const title = candidate.title === undefined ? undefined : titleField(candidate.title);
  const completed = candidate.completed === undefined ? undefined : flag("completed", candidate.completed);

  if (title !== undefined && !title.ok) {
    return err(problemsFrom(title.error, [completed]));
  }
  if (completed !== undefined && !completed.ok) {
    return err([completed.error]);
  }

  return ok({
    ...(title === undefined ? {} : { title: title.value }),
    ...(completed === undefined ? {} : { completed: completed.value }),
  });
};
