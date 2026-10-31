import type { TodoReply } from "@todo/contract";
import type { Todo } from "../../business/todos/todo.ts";

/** A business todo on the wire. Fields are copied by name, so none leaks. */
export const presentTodo = (todo: Todo): TodoReply => ({
  id: todo.id,
  title: todo.title,
  completed: todo.completed,
});
