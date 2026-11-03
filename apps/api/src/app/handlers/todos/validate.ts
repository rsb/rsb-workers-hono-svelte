/**
 * Every validation only the todos handlers need, in one file. Split it only
 * if it grows too large. Validation every handler shares is in
 * `../validate.ts`.
 */

import { type Result, err, ok } from "@todo/business/result.ts";
import { TITLE_MAX } from "@todo/business/todos/todo.ts";
import { type Fail, invalid } from "@todo/fail/fail.ts";
import { checkTitle } from "@todo/valid/todos/title.ts";

/**
 * Checks the title a body asks for, by the rule in `@todo/valid`, and gives
 * it trimmed. A broken rule is an `invalid` failure on the `title` field.
 */
export const validateTitle = (body: { title: string }): Result<{ title: string }, Fail<"invalid">> => {
  const checked = checkTitle(body.title);
  if (checked.ok) {
    return ok({ title: checked.value });
  }

  if (checked.error === "empty") {
    return err(invalid("title", "title is empty"));
  }

  return err(invalid("title", `title is longer than ${TITLE_MAX} characters`));
};
