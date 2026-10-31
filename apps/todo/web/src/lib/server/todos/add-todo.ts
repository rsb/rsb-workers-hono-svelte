import { AddTodoBody, type ErrorKind } from "@todo/contract";
import { fail } from "@sveltejs/kit";
import * as v from "valibot";
import { postTodo } from "../api/todos.ts";

/** The BFF's own status for each kind the API can answer with. */
const status = (kind: ErrorKind) => (kind === "validation" ? 422 : kind === "limit" ? 409 : 500);

/**
 * The `add` action: validate the form with the contract's rule, ask the API,
 * turn a failure into `fail`, and present what was added.
 */
export async function addTodo(api: Pick<Fetcher, "fetch">, form: FormData) {
  const raw = form.get("title");
  const title = typeof raw === "string" ? raw : "";

  const input = v.safeParse(AddTodoBody, { title });
  if (!input.success) return fail(422, { title, message: input.issues[0].message });

  const reply = await postTodo(api, input.output);
  if (!reply.ok) return fail(status(reply.error.kind), { title, message: reply.error.message });

  return { added: reply.data.title };
}
