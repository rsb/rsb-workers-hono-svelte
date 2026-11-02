import * as v from "valibot";

/**
 * The body of `POST /todos`: its shape only. Unknown keys are rejected. The
 * title's rules (trim, empty, too long) are checked by each handler.
 */
export const AddTodoBody = v.strictObject({ title: v.string("title must be text") });
export type AddTodoBody = v.InferOutput<typeof AddTodoBody>;

/** A todo on the wire. */
export const TodoReply = v.strictObject({
  id: v.string(),
  title: v.string(),
  completed: v.boolean(),
});
export type TodoReply = v.InferOutput<typeof TodoReply>;

/** The data of `GET /todos`, in creation order. */
export const TodoListReply = v.array(TodoReply);
export type TodoListReply = v.InferOutput<typeof TodoListReply>;
