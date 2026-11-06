// Generated from prd/todo/api.md by tooling/api-spec/generate.ts. Do not edit: change the spec and regenerate.
import * as v from "valibot";

/** A todo on the wire. The data of `POST /todos` and `PATCH /todos/{id}`. */
export const TodoReply = v.strictObject({
  id: v.string(),
  title: v.string(),
  completed: v.boolean(),
});
export type TodoReply = v.InferOutput<typeof TodoReply>;

/** Todos in creation order. The data of `GET /todos`, `PATCH /todos` and `DELETE /todos`. */
export const TodoListReply = v.array(TodoReply);
export type TodoListReply = v.InferOutput<typeof TodoListReply>;

/** The signed-in user a request acts for, with what the frame shows. */
export const SessionUser = v.strictObject({
  id: v.string(),
  role: v.picklist(["member", "admin"]),
  emailVerified: v.boolean(),
  name: v.string(),
  email: v.string(),
});
export type SessionUser = v.InferOutput<typeof SessionUser>;

/** What a sign-out answers: only that it holds. The BFF deletes its own cookie; the api never writes `Set-Cookie` (L40). The data of `DELETE /sessions` and `DELETE /sessions/current`. */
export const SignedOutReply = v.strictObject({
  signedOut: v.literal(true),
});
export type SignedOutReply = v.InferOutput<typeof SignedOutReply>;

/** One live session of the actor's, as Sessions shows it (L51). `label` and `city` are absent when the request that started it gave neither. Both are display only. Times are milliseconds since the epoch. */
export const DeviceSessionReply = v.strictObject({
  id: v.string(),
  label: v.exactOptional(v.string()),
  city: v.exactOptional(v.string()),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  touchedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  thisDevice: v.boolean(),
});
export type DeviceSessionReply = v.InferOutput<typeof DeviceSessionReply>;

/** The data of `GET /health`. */
export const HealthReply = v.strictObject({
  ok: v.literal(true),
});
export type HealthReply = v.InferOutput<typeof HealthReply>;

/** The data of `GET /sessions/current`. */
export const SessionReply = v.strictObject({
  user: v.exactOptional(SessionUser),
  clearCookie: v.boolean(),
});
export type SessionReply = v.InferOutput<typeof SessionReply>;

/** The body of `POST /sessions`. */
export const SignInBody = v.strictObject({
  email: v.string("email must be text"),
  password: v.string("password must be text"),
});
export type SignInBody = v.InferOutput<typeof SignInBody>;

/** The data of `POST /sessions`. */
export const SignedInReply = v.strictObject({
  token: v.string(),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type SignedInReply = v.InferOutput<typeof SignedInReply>;

/** The data of `GET /sessions`. */
export const DeviceSessionListReply = v.strictObject({
  sessions: v.array(DeviceSessionReply),
  more: v.boolean(),
});
export type DeviceSessionListReply = v.InferOutput<typeof DeviceSessionListReply>;

/** The query of `GET /todos`. */
export const GetTodosQuery = v.strictObject({
  completed: v.exactOptional(v.picklist(["true", "false"], "completed must be true or false")),
});
export type GetTodosQuery = v.InferOutput<typeof GetTodosQuery>;

/** The data of `GET /todos/counts`. */
export const TodoCountsReply = v.strictObject({
  active: v.pipe(v.number(), v.integer(), v.minValue(0)),
  completed: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type TodoCountsReply = v.InferOutput<typeof TodoCountsReply>;

/** The body of `POST /todos`. */
export const AddTodoBody = v.strictObject({
  title: v.string("title must be text"),
});
export type AddTodoBody = v.InferOutput<typeof AddTodoBody>;

/** The body of `PATCH /todos`. */
export const PatchTodosBody = v.strictObject({
  completed: v.boolean("completed must be true or false"),
});
export type PatchTodosBody = v.InferOutput<typeof PatchTodosBody>;

/** The body of `PATCH /todos/{id}`. */
export const PatchTodoBody = v.pipe(
  v.strictObject({
    title: v.exactOptional(v.string("title must be text")),
    completed: v.exactOptional(v.boolean("completed must be true or false")),
  }),
  v.minEntries(1, "body must have title, completed or both"),
);
export type PatchTodoBody = v.InferOutput<typeof PatchTodoBody>;

/** The query of `DELETE /todos`. */
export const DeleteTodosQuery = v.strictObject({
  completed: v.literal("true", "completed must be true"),
});
export type DeleteTodosQuery = v.InferOutput<typeof DeleteTodosQuery>;

/** The data of `DELETE /todos/{id}`. */
export const DeletedReply = v.strictObject({
  id: v.string(),
});
export type DeletedReply = v.InferOutput<typeof DeletedReply>;
