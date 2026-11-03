import { fail } from "@sveltejs/kit";
import { patchTodo } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG } from "./messages.ts";
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
  const completed = text(form.get("completed"));

  // The page always sends both; anything else did not come from it.
  const hasId = id !== "";
  const isBoolean = completed === "true" || completed === "false";
  if (!hasId || !isBoolean) {
    return fail(422, { toggle: { id, message: SOMETHING_WENT_WRONG } });
  }

  const reply = await patchTodo(api, id, { completed: completed === "true" });
  if (!reply.ok) {
    const kind = reply.error.kind;
    return fail(status(kind), { toggle: { id, message: SOMETHING_WENT_WRONG } });
  }

  return { toggled: reply.data.id };
}
