// Generated from prd/todo/api.md by tooling/api-spec/generate.ts. Do not edit: change the spec and regenerate.
import type * as v from "valibot";
import type { ErrorKind } from "./kinds.ts";
import {
  AddTodoBody,
  DeleteTodosQuery,
  DeletedReply,
  GetTodosQuery,
  HealthReply,
  PatchTodoBody,
  PatchTodosBody,
  TodoCountsReply,
  TodoListReply,
  TodoReply,
} from "./messages.ts";

/**
 * An endpoint as plain data: its method and path, with path parameters in
 * braces; the schemas of its query, body and reply; its success status; and
 * every error kind it can return.
 */
export type Endpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  params: readonly string[];
  query?: v.GenericSchema;
  body?: v.GenericSchema;
  status: number;
  reply: v.GenericSchema;
  errors: readonly ErrorKind[];
};

/** Every endpoint the api serves, keyed by method and path as the spec writes them. */
export const endpoints = {
  "GET /health": {
    method: "GET",
    path: "/health",
    params: [],
    status: 200,
    reply: HealthReply,
    errors: ["too_large", "internal"],
  },
  "GET /todos": {
    method: "GET",
    path: "/todos",
    params: [],
    query: GetTodosQuery,
    status: 200,
    reply: TodoListReply,
    errors: ["validation", "too_large", "internal"],
  },
  "GET /todos/counts": {
    method: "GET",
    path: "/todos/counts",
    params: [],
    status: 200,
    reply: TodoCountsReply,
    errors: ["too_large", "internal"],
  },
  "POST /todos": {
    method: "POST",
    path: "/todos",
    params: [],
    body: AddTodoBody,
    status: 201,
    reply: TodoReply,
    errors: ["validation", "limit", "too_large", "internal"],
  },
  "PATCH /todos": {
    method: "PATCH",
    path: "/todos",
    params: [],
    body: PatchTodosBody,
    status: 200,
    reply: TodoListReply,
    errors: ["validation", "too_large", "internal"],
  },
  "PATCH /todos/{id}": {
    method: "PATCH",
    path: "/todos/{id}",
    params: ["id"],
    body: PatchTodoBody,
    status: 200,
    reply: TodoReply,
    errors: ["validation", "not_found", "too_large", "internal"],
  },
  "DELETE /todos": {
    method: "DELETE",
    path: "/todos",
    params: [],
    query: DeleteTodosQuery,
    status: 200,
    reply: TodoListReply,
    errors: ["validation", "too_large", "internal"],
  },
  "DELETE /todos/{id}": {
    method: "DELETE",
    path: "/todos/{id}",
    params: ["id"],
    status: 200,
    reply: DeletedReply,
    errors: ["not_found", "too_large", "internal"],
  },
} as const satisfies Record<string, Endpoint>;

export type EndpointKey = keyof typeof endpoints;

/** The error kinds an endpoint can return, as a type a switch can be exhaustive over. */
export type EndpointErrors<K extends EndpointKey> = (typeof endpoints)[K]["errors"][number];
