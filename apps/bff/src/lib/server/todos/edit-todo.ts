import { fail } from "@sveltejs/kit";
import { checkTitle } from "@todo/valid/todos/title.ts";
import { patchTodo } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG, TITLE_RULE } from "./messages.ts";
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

  const checked = checkTitle(title);
  if (!checked.ok && checked.error === "empty") {
    return { edited: id };
  }
  if (!checked.ok) {
    return fail(422, { edit: { id, title, message: TITLE_RULE } });
  }

  const reply = await patchTodo(api, id, { title: checked.value });
  if (!reply.ok) {
    const kind = reply.error.kind;
    return fail(status(kind), { edit: { id, title, message: SOMETHING_WENT_WRONG } });
  }

  return { edited: reply.data.id };
}
