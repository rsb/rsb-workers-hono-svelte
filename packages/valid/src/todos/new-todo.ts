// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import { type Result, err, ok } from "@todo/business/result.ts";
import type { RuleId } from "@todo/business/rules.ts";
import type { NewTodo } from "@todo/business/todos/todo.ts";
import { text } from "../fields/decode.ts";
import type { Problem, Problems } from "../problem.ts";
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

/** What a delivery read for a `NewTodo`, not yet decoded. */
export type NewTodoCandidate = { title: unknown };

/**
 * A `NewTodo` from what a delivery read. What someone asks to add. Gives every
 * problem it finds, as prd/todo/rules.md › Every input says.
 */
export const toNewTodo = (candidate: NewTodoCandidate): Result<NewTodo, Problems> => {
  const title = titleField(candidate.title);

  if (!title.ok) {
    return err([title.error]);
  }

  return ok({ title: title.value });
};

/** The rules `toNewTodo` applies, by id: what a route that runs it applies (L33). */
toNewTodo.rules = ["title.length"] as const satisfies readonly RuleId[];
