/** A todo, as the api's own code knows it. The wire shape is contract's `TodoReply`. */
export type Todo = { id: string; title: string; completed: boolean };

/** The most todos the list holds (PRD deviation 9). */
export const TODO_LIMIT = 500;

/** A new todo is not completed. The title is already valid. */
export const newTodo = (id: string, title: string): Todo => ({ id, title, completed: false });
