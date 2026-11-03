import type { ErrorKind } from "@todo/contract-api";
import { fail } from "@sveltejs/kit";
import { postTodo } from "../api/todos.ts";
import { addFailedMessage } from "./messages.ts";
import { validateTitle } from "./validate-title.ts";

/** The BFF's own status for each kind the API can answer with (PRD, Envelope). */
const status = (kind: ErrorKind): number => {
  switch (kind) {
    case "validation":
      return 422;
    case "not_found":
      return 404;
    case "limit":
      return 409;
    case "too_large":
      return 413;
    case "internal":
      return 500;
  }
};

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
