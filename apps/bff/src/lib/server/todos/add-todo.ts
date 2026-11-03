import { fail } from "@sveltejs/kit";
import { postTodo } from "../api/todos.ts";
import { addFailedMessage } from "./messages.ts";
import { status } from "./status.ts";
import { validateTitle } from "./validate-title.ts";

/**
 * The `add` action: validate the title, ask the API, turn a failure into
 * `fail` with the message the page shows, and present what was added. A
 * failure keeps what was typed, so the input still holds it.
 */
export async function addTodo(api: Pick<Fetcher, "fetch">, form: FormData) {
  const raw = form.get("title");
  let title = "";
  if (typeof raw === "string") {
    title = raw;
  }

  const newTodo = validateTitle({ title });
  if (!newTodo.ok) {
    return fail(422, { title, message: newTodo.error });
  }

  const reply = await postTodo(api, newTodo.value);
  if (!reply.ok) {
    const kind = reply.error.kind;
    return fail(status(kind), { title, message: addFailedMessage(kind) });
  }

  return { added: reply.data.title };
}
