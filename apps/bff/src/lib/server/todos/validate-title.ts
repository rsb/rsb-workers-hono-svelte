import { type Result, err, ok } from "@todo/business/result.ts";
import { type NewTodo, TITLE_MAX } from "@todo/business/todos/todo.ts";

/**
 * Checks the title the form asks for, before the API is asked. The title is
 * trimmed first, then it must not be empty and must not be longer than
 * `TITLE_MAX`. The API checks the same rules; this saves the user a round trip.
 */
export const validateTitle = (form: { title: string }): Result<NewTodo, string> => {
  const title = form.title.trim();

  if (title.length === 0) {
    return err("title is empty");
  }

  if (title.length > TITLE_MAX) {
    return err(`title is longer than ${TITLE_MAX} characters`);
  }

  return ok({ title });
};
