import type { ErrorKind } from "@todo/contract-api";
import { fail } from "@sveltejs/kit";
import { postTodo } from "../api/todos.ts";
import { validateTitle } from "./validate-title.ts";

/** The BFF's own status for each kind the API can answer with. */
const status = (kind: ErrorKind) => (kind === "validation" ? 422 : kind === "limit" ? 409 : 500);

/**
 * The `add` action: validate the title, ask the API, turn a failure into
 * `fail`, and present what was added.
 */
export async function addTodo(api: Pick<Fetcher, "fetch">, form: FormData) {
  const raw = form.get("title");
  const title = typeof raw === "string" ? raw : "";

  const newTodo = validateTitle({ title });
  if (!newTodo.ok) {
    return fail(422, { title, message: newTodo.error });
  }

  const reply = await postTodo(api, newTodo.value);
  if (!reply.ok) {
    return fail(status(reply.error.kind), { title, message: reply.error.message });
  }

  return { added: reply.data.title };
}
