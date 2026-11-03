import { type AddTodoBody, DeletedReply, type PatchTodoBody, TodoListReply, TodoReply } from "@todo/contract-api";
import { call } from "./call.ts";

type Api = Pick<Fetcher, "fetch">;

/** `GET /todos`: every todo, in creation order. */
export const getTodos = (api: Api) => call(api, "/todos", {}, TodoListReply);

/** `POST /todos`: the added todo. */
export const postTodo = (api: Api, body: AddTodoBody) =>
  call(api, "/todos", { method: "POST", body: JSON.stringify(body) }, TodoReply);

/** `PATCH /todos/:id`: the todo as it now is. */
export const patchTodo = (api: Api, id: string, body: PatchTodoBody) => {
  const path = `/todos/${encodeURIComponent(id)}`;
  return call(api, path, { method: "PATCH", body: JSON.stringify(body) }, TodoReply);
};

/** `DELETE /todos/:id`: the id of the todo deleted. */
export const deleteTodo = (api: Api, id: string) => {
  const path = `/todos/${encodeURIComponent(id)}`;
  return call(api, path, { method: "DELETE" }, DeletedReply);
};
