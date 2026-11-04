/** A todo, as the api's own code knows it. The wire shape is contract's `TodoReply`. */
export type Todo = { id: string; title: string; completed: boolean };

/**
 * What someone asks to add: only a title. It is not a todo yet; adding it
 * gives it an id and makes it not completed.
 */
export type NewTodo = { title: string };

/**
 * What someone asks to change in a todo: its title, its `completed`, or
 * both. A title here was already validated by a handler.
 */
export type TodoPatch = { title?: string; completed?: boolean };

/**
 * Which todos to list: with `completed` only those with that value, without
 * it every todo.
 */
export type TodoFilter = { completed?: boolean };

/** How many todos are active and how many completed, over every todo. */
export type TodoCounts = { active: number; completed: number };

/** A new todo is not completed. Its title was already validated by a handler. */
export const newTodo = (id: string, input: NewTodo): Todo => {
  return { id, title: input.title, completed: false };
};
