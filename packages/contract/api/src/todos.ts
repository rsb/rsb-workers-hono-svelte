import * as v from "valibot";

/**
 * The body of `POST /todos`: its shape only. Unknown keys are rejected. The
 * title's rules (trim, empty, too long) are checked by each handler.
 */
export const AddTodoBody = v.strictObject({ title: v.string("title must be text") });
export type AddTodoBody = v.InferOutput<typeof AddTodoBody>;

/**
 * The body of `PATCH /todos/:id`: its shape only. It has `title`,
 * `completed` or both; unknown keys are rejected. The title's rules are
 * checked by the handler, as for `AddTodoBody`.
 */
export const PatchTodoBody = v.pipe(
  v.strictObject({
    title: v.exactOptional(v.string("title must be text")),
    completed: v.exactOptional(v.boolean("completed must be true or false")),
  }),
  v.check((body) => {
    const hasTitle = body.title !== undefined;
    const hasCompleted = body.completed !== undefined;
    return hasTitle || hasCompleted;
  }, "body must have title, completed or both"),
);
export type PatchTodoBody = v.InferOutput<typeof PatchTodoBody>;

/**
 * The body of `PATCH /todos`: the value to set `completed` to on every
 * todo. It is the value, not "flip it", so sending it twice is safe.
 * Unknown keys are rejected.
 */
export const PatchTodosBody = v.strictObject({
  completed: v.boolean("completed must be true or false"),
});
export type PatchTodosBody = v.InferOutput<typeof PatchTodosBody>;

/**
 * The query of `DELETE /todos`: `completed=true`, the only delete of many
 * there is. Without it the request is refused, never read as "delete all".
 * Unknown keys are rejected.
 */
export const DeleteTodosQuery = v.strictObject({
  completed: v.literal("true", "completed must be true"),
});
export type DeleteTodosQuery = v.InferOutput<typeof DeleteTodosQuery>;

/**
 * The query of `GET /todos`: no query lists every todo; `completed=true` or
 * `completed=false` lists only those. A query's values are text, so the
 * handler turns the value into a boolean. Unknown keys are rejected.
 */
export const GetTodosQuery = v.strictObject({
  completed: v.exactOptional(v.picklist(["true", "false"], "completed must be true or false")),
});
export type GetTodosQuery = v.InferOutput<typeof GetTodosQuery>;

/** A todo on the wire. */
export const TodoReply = v.strictObject({
  id: v.string(),
  title: v.string(),
  completed: v.boolean(),
});
export type TodoReply = v.InferOutput<typeof TodoReply>;

/** The data of `GET /todos`, `PATCH /todos` and `DELETE /todos`, in creation order. */
export const TodoListReply = v.array(TodoReply);
export type TodoListReply = v.InferOutput<typeof TodoListReply>;

/** The data of `DELETE /todos/:id`: the id of the todo deleted. */
export const DeletedReply = v.strictObject({ id: v.string() });
export type DeletedReply = v.InferOutput<typeof DeletedReply>;

/** The data of `GET /todos/counts`: how many todos are active and how many completed. */
export const TodoCountsReply = v.strictObject({
  active: v.pipe(v.number(), v.integer(), v.minValue(0)),
  completed: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type TodoCountsReply = v.InferOutput<typeof TodoCountsReply>;
