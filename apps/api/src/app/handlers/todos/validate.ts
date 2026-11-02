/**
 * Every validation only the todos handlers need, in one file. Split it only
 * if it grows too large. Validation every handler shares is in
 * `../validate.ts`.
 */

import { type Result, err, ok } from "@todo/business/result.ts";
import { type NewTodo, TITLE_MAX } from "@todo/business/todos/todo.ts";
import { type Fail, invalid } from "@todo/fail/fail.ts";

/**
 * Checks the title a body asks for. The title is trimmed first, then it must
 * not be empty and must not be longer than `TITLE_MAX`. A valid title becomes
 * the new todo to add.
 */
export const validateTitle = (body: { title: string }): Result<NewTodo, Fail<"invalid">> => {
  const title = body.title.trim();

  if (title.length === 0) {
    return err(invalid("title", "title is empty"));
  }

  if (title.length > TITLE_MAX) {
    return err(invalid("title", `title is longer than ${TITLE_MAX} characters`));
  }

  return ok({ title });
};
