import { addTodo } from "#lib/server/todos/add-todo.ts";
import { clearCompletedTodos } from "#lib/server/todos/clear-completed-todos.ts";
import { editTodo } from "#lib/server/todos/edit-todo.ts";
import { loadTodos } from "#lib/server/todos/load-todos.ts";
import { markAllTodos } from "#lib/server/todos/mark-all-todos.ts";
import { removeTodo } from "#lib/server/todos/remove-todo.ts";
import { toggleTodo } from "#lib/server/todos/toggle-todo.ts";
import type { Actions, PageServerLoad } from "./$types";

/** `/` has no `filter` param; it lists every todo. */
export const load: PageServerLoad = ({ params, locals }) => {
  const filter = params.filter ?? "all";
  return loadTodos(locals.api, filter);
};

export const actions = {
  add: async ({ request, locals }) => addTodo(locals.api, await request.formData()),
  toggle: async ({ request, locals }) => toggleTodo(locals.api, await request.formData()),
  edit: async ({ request, locals }) => editTodo(locals.api, await request.formData()),
  markAll: async ({ request, locals }) => markAllTodos(locals.api, await request.formData()),
  remove: async ({ request, locals }) => removeTodo(locals.api, await request.formData()),
  clearCompleted: async ({ locals }) => clearCompletedTodos(locals.api),
} satisfies Actions;
