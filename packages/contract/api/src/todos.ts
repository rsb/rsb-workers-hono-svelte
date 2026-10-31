import * as v from "valibot";
import { TITLE_MAX } from "./limits.ts";

/** A title is trimmed, then must be 1 to `TITLE_MAX` characters. */
export const Title = v.pipe(
  v.string("title must be text"),
  v.trim(),
  v.minLength(1, "title is empty"),
  v.maxLength(TITLE_MAX, `title is longer than ${TITLE_MAX} characters`),
);

/** The body of `POST /todos`. Unknown keys are rejected. */
export const AddTodoBody = v.strictObject({ title: Title });
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
