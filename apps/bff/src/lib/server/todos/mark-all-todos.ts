import { fail } from "@sveltejs/kit";
import { patchTodos } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG } from "./messages.ts";
import { status } from "./status.ts";

/**
 * The `markAll` action: read the value every todo should take, ask the API,
 * and turn a failure into `fail` with the message the new-todo line shows.
 * The button sends the new value, not "flip it", so sending it twice is safe.
 *
 * The person cannot fix a failed mark all, so every failure says the same.
 */
export async function markAllTodos(api: Pick<Fetcher, "fetch">, form: FormData) {
  const completed = form.get("completed");

  // The page always sends "true" or "false"; anything else did not come from it.
  const isBoolean = completed === "true" || completed === "false";
  if (!isBoolean) {
    return fail(422, { markAll: { message: SOMETHING_WENT_WRONG } });
  }

  const value = completed === "true";
  const reply = await patchTodos(api, { completed: value });
  if (!reply.ok) {
    const kind = reply.error.kind;
    return fail(status(kind), { markAll: { message: SOMETHING_WENT_WRONG } });
  }

  return { markedAll: value };
}
