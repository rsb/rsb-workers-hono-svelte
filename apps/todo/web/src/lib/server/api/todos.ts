import { type AddTodoBody, TodoListReply, TodoReply } from "@todo/contract";
import { call } from "./call.ts";

type Api = Pick<Fetcher, "fetch">;

/** `GET /todos`: every todo, in creation order. */
export const getTodos = (api: Api) => call(api, "/todos", {}, TodoListReply);

/** `POST /todos`: the added todo. */
export const postTodo = (api: Api, body: AddTodoBody) =>
  call(api, "/todos", { method: "POST", body: JSON.stringify(body) }, TodoReply);
