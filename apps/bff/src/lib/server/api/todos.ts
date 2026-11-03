import { type AddTodoBody, TodoListReply, TodoReply, type ToggleTodoBody } from "@todo/contract-api";
import { call } from "./call.ts";

type Api = Pick<Fetcher, "fetch">;

/** `GET /todos`: every todo, in creation order. */
export const getTodos = (api: Api) => call(api, "/todos", {}, TodoListReply);

/** `POST /todos`: the added todo. */
export const postTodo = (api: Api, body: AddTodoBody) =>
  call(api, "/todos", { method: "POST", body: JSON.stringify(body) }, TodoReply);

/** `PATCH /todos/:id`: the todo as it now is. */
export const patchTodo = (api: Api, id: string, body: ToggleTodoBody) => {
  const path = `/todos/${encodeURIComponent(id)}`;
  return call(api, path, { method: "PATCH", body: JSON.stringify(body) }, TodoReply);
};
