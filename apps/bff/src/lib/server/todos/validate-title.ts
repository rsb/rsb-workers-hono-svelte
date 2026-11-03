import { type Result, err, ok } from "@todo/business/result.ts";
import type { NewTodo } from "@todo/business/todos/todo.ts";
import { checkTitle } from "@todo/valid/todos/title.ts";
import { TITLE_RULE } from "./messages.ts";

/**
 * Checks the title the add form asks for, by the rule in `@todo/valid`,
 * before the API is asked. Empty and too long get the same message. The API
 * checks the same rule; this saves the user a round trip.
 */
export const validateTitle = (form: { title: string }): Result<NewTodo, string> => {
  const checked = checkTitle(form.title);
  if (!checked.ok) {
    return err(TITLE_RULE);
  }

  return ok({ title: checked.value });
};
