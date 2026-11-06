import {
  type AddTodoBody,
  DeletedReply,
  type DeleteTodosQuery,
  type GetTodosQuery,
  type PatchTodoBody,
  type PatchTodosBody,
  TodoCountsReply,
  TodoListReply,
  TodoReply,
} from "@todo/contract-api";
import { call } from "./call.ts";

type Api = Pick<Fetcher, "fetch">;

/**
 * A call with a JSON body, saying so: the api's `channel` gate refuses a
 * body of any other type on a request that is not bearer (L38, L49), and a
 * string body is otherwise sent as `text/plain`.
 */
const json = (method: "POST" | "PATCH", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * `GET /todos`: every todo, or with `completed` only those, in creation
 * order. An empty query sends no `?`.
 */
export const getTodos = (api: Api, query: GetTodosQuery = {}) => {
  const search = new URLSearchParams(query).toString();
  let path = "/todos";
  if (search !== "") {
    path = `/todos?${search}`;
  }
  return call(api, path, {}, TodoListReply);
};

/** `GET /todos/counts`: how many todos are active and how many completed. */
export const getTodoCounts = (api: Api) => call(api, "/todos/counts", {}, TodoCountsReply);

/** `POST /todos`: the added todo. */
export const postTodo = (api: Api, body: AddTodoBody) =>
  call(api, "/todos", json("POST", body), TodoReply);

/** `PATCH /todos/:id`: the todo as it now is. */
export const patchTodo = (api: Api, id: string, body: PatchTodoBody) => {
  const path = `/todos/${encodeURIComponent(id)}`;
  return call(api, path, json("PATCH", body), TodoReply);
};

/** `PATCH /todos`: every todo as it now is, in creation order. */
export const patchTodos = (api: Api, body: PatchTodosBody) =>
  call(api, "/todos", json("PATCH", body), TodoListReply);

/** `DELETE /todos/:id`: the id of the todo deleted. */
export const deleteTodo = (api: Api, id: string) => {
  const path = `/todos/${encodeURIComponent(id)}`;
  return call(api, path, { method: "DELETE" }, DeletedReply);
};

/** `DELETE /todos?completed=true`: the todos left, in creation order. */
export const deleteTodos = (api: Api, query: DeleteTodosQuery) => {
  const path = `/todos?${new URLSearchParams(query)}`;
  return call(api, path, { method: "DELETE" }, TodoListReply);
};
