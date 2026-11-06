import { fail } from "@sveltejs/kit";
import { deleteTodo } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG, failedMessage } from "./messages.ts";
import { status } from "./status.ts";

/** A form value as text, or empty when it is missing or a file. */
const text = (value: FormDataEntryValue | null): string => {
  if (typeof value === "string") {
    return value;
  }
  return "";
};

/**
 * The `remove` action: read which todo, ask the API to delete it, and turn
 * a failure into `fail` with the message the row shows.
 *
 * A todo that is already gone is what the person asked for, so `not_found`
 * is a success: the reloaded list no longer has it. The person cannot fix
 * any other failure, so every one says the same.
 */
export async function removeTodo(api: Pick<Fetcher, "fetch">, form: FormData) {
  const id = text(form.get("id"));

  // The page always sends the id; a form without one did not come from it.
  const hasId = id !== "";
  if (!hasId) {
    return fail(422, { remove: { id, message: SOMETHING_WENT_WRONG } });
  }

  const reply = await deleteTodo(api, id);
  if (!reply.ok) {
    const kind = reply.error.kind;
    const alreadyGone = kind === "not_found";
    if (alreadyGone) {
      return { removed: id };
    }
    return fail(status(kind), { remove: { id, message: failedMessage(reply.error) } });
  }

  return { removed: reply.data.id };
}
