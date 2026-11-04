import { fail } from "@sveltejs/kit";
import { toTodoPatch } from "@todo/valid/todos/todo-patch.ts";
import { patchTodo } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG, problemMessage } from "./messages.ts";
import { status } from "./status.ts";

/** A form value as text, or empty when it is missing or a file. */
const text = (value: FormDataEntryValue | null): string => {
  if (typeof value === "string") {
    return value;
  }
  return "";
};

/**
 * The `edit` action: read which todo and the title typed, ask the API, and
 * turn a failure into `fail` with the message shown under the input. Every
 * failure keeps what was typed, so the input still holds it.
 *
 * A title empty after trim leaves the todo as it is: it is a success, and
 * the API is not asked (PRD deviation 19).
 */
export async function editTodo(api: Pick<Fetcher, "fetch">, form: FormData) {
  const id = text(form.get("id"));
  const title = text(form.get("title"));

  // The page always sends an id; a form without one did not come from it.
  if (id === "") {
    return fail(422, { edit: { id, title, message: SOMETHING_WENT_WRONG } });
  }

  // The title must follow the business rules. An empty one is not a
  // failure here: it leaves the todo as it is.
  const patch = toTodoPatch({ title: form.get("title") });
  if (!patch.ok) {
    const [problem] = patch.error;
    if (problem.rule === "title.empty") {
      return { edited: id };
    }
    return fail(422, { edit: { id, title, message: problemMessage(problem) } });
  }

  const reply = await patchTodo(api, id, patch.value);
  if (!reply.ok) {
    const kind = reply.error.kind;
    return fail(status(kind), { edit: { id, title, message: SOMETHING_WENT_WRONG } });
  }

  return { edited: reply.data.id };
}
