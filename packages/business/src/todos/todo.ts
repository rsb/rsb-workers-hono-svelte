/** A todo, as the api's own code knows it. The wire shape is contract's `TodoReply`. */
export type Todo = { id: string; title: string; completed: boolean };

/**
 * What someone asks to add: only a title. It is not a todo yet; adding it
 * gives it an id and makes it not completed.
 */
export type NewTodo = { title: string };

/** The longest title, after trim, in UTF-16 code units (PRD deviation 7). */
export const TITLE_MAX = 256;

/** The most todos the list holds (PRD deviation 9). */
export const TODO_LIMIT = 500;

/** A new todo is not completed. Its title was already validated by a handler. */
export const newTodo = (id: string, input: NewTodo): Todo => {
  return { id, title: input.title, completed: false };
};
