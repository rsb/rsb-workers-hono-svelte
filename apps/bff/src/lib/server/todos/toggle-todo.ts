import { fail } from "@sveltejs/kit";
import { toTodoPatch } from "@todo/valid/todos/todo-patch.ts";
import { patchTodo } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG, failedMessage, problemMessage } from "./messages.ts";
import { status } from "./status.ts";

/** A form value as text, or empty when it is missing or a file. */
const text = (value: FormDataEntryValue | null): string => {
  if (typeof value === "string") {
    return value;
  }
  return "";
};

/**
 * The `toggle` action: read which todo and the value it should take, ask
 * the API, and turn a failure into `fail` with the message the row shows.
 * The form sends the new value, not "flip it", so sending it twice is safe.
 *
 * The person cannot fix a failed toggle, so every failure says the same.
 * One for a todo removed elsewhere is also gone from the reloaded list.
 */
export async function toggleTodo(api: Pick<Fetcher, "fetch">, form: FormData) {
  const id = text(form.get("id"));

  // The page always sends an id; a form without one did not come from it.
  if (id === "") {
    return fail(422, { toggle: { id, message: SOMETHING_WENT_WRONG } });
  }

  // completed must be true or false.
  const patch = toTodoPatch({ completed: form.get("completed") });
  if (!patch.ok) {
    const [problem] = patch.error;
    return fail(422, { toggle: { id, message: problemMessage(problem) } });
  }

  const reply = await patchTodo(api, id, patch.value);
  if (!reply.ok) {
    const kind = reply.error.kind;
    return fail(status(kind), { toggle: { id, message: failedMessage(reply.error) } });
  }

  return { toggled: reply.data.id };
}
