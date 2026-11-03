import { type Result, err, ok } from "@todo/business/result.ts";
import { type NewTodo, TITLE_MAX } from "@todo/business/todos/todo.ts";
import { TITLE_RULE } from "./messages.ts";

/**
 * Checks the title the form asks for, before the API is asked. The title is
 * trimmed first, then it must not be empty and must not be longer than
 * `TITLE_MAX`. Both breaks get the same message. The API checks the same
 * rules; this saves the user a round trip.
 */
export const validateTitle = (form: { title: string }): Result<NewTodo, string> => {
  const title = form.title.trim();

  const empty = title.length === 0;
  const tooLong = title.length > TITLE_MAX;
  if (empty || tooLong) {
    return err(TITLE_RULE);
  }

  return ok({ title });
};
