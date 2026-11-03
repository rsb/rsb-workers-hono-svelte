import { env } from "cloudflare:workers";
import { addTodo } from "#lib/server/todos/add-todo.ts";
import { editTodo } from "#lib/server/todos/edit-todo.ts";
import { loadTodos } from "#lib/server/todos/load-todos.ts";
import { markAllTodos } from "#lib/server/todos/mark-all-todos.ts";
import { removeTodo } from "#lib/server/todos/remove-todo.ts";
import { toggleTodo } from "#lib/server/todos/toggle-todo.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = () => loadTodos(env.API);

export const actions = {
  add: async ({ request }) => addTodo(env.API, await request.formData()),
  toggle: async ({ request }) => toggleTodo(env.API, await request.formData()),
  edit: async ({ request }) => editTodo(env.API, await request.formData()),
  markAll: async ({ request }) => markAllTodos(env.API, await request.formData()),
  remove: async ({ request }) => removeTodo(env.API, await request.formData()),
} satisfies Actions;
