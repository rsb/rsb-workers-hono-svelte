import { env } from "cloudflare:workers";
import { addTodo } from "#lib/server/todos/add-todo.ts";
import { loadTodos } from "#lib/server/todos/load-todos.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = () => loadTodos(env.API);

export const actions = {
  add: async ({ request }) => addTodo(env.API, await request.formData()),
} satisfies Actions;
