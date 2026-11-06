import { fail } from "@sveltejs/kit";
import { toNewTodo } from "@todo/valid/todos/new-todo.ts";
import { postTodo } from "../api/todos.ts";
import { addFailedMessage, problemMessage } from "./messages.ts";
import { status } from "./status.ts";

/**
 * The `add` action: make the form a new todo, ask the API, turn a failure
 * into `fail` with the message the page shows, and present what was added.
 * A failure keeps what was typed, so the input still holds it.
 */
export async function addTodo(api: Pick<Fetcher, "fetch">, form: FormData) {
  const raw = form.get("title");
  let title = "";
  if (typeof raw === "string") {
    title = raw;
  }

  // The title must follow the business rules; this saves the user a round trip.
  const newTodo = toNewTodo({ title: raw });
  if (!newTodo.ok) {
    const [problem] = newTodo.error;
    return fail(422, { title, message: problemMessage(problem) });
  }

  const reply = await postTodo(api, newTodo.value);
  if (!reply.ok) {
    const kind = reply.error.kind;
    return fail(status(kind), { title, message: addFailedMessage(reply.error) });
  }

  return { added: reply.data.title };
}
