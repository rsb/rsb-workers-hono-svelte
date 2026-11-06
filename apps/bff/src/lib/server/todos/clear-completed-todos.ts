import { fail } from "@sveltejs/kit";
import { deleteTodos } from "../api/todos.ts";
import { failedMessage } from "./messages.ts";
import { status } from "./status.ts";

/**
 * The `clearCompleted` action: ask the API to delete every completed todo,
 * and turn a failure into `fail` with the message the footer shows. The
 * form has no fields; the action always sends `completed=true`.
 *
 * The person cannot fix a failed clear, so every failure says the same.
 * Nothing to clear is not a failure: the API answers the list as it was.
 */
export async function clearCompletedTodos(api: Pick<Fetcher, "fetch">) {
  const reply = await deleteTodos(api, { completed: "true" });
  if (!reply.ok) {
    const kind = reply.error.kind;
    return fail(status(kind), { clearCompleted: { message: failedMessage(reply.error) } });
  }

  return { cleared: true };
}
