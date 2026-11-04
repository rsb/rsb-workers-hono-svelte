# Todo api

The `todo-api` Worker, reached only through the BFF's `API` binding
(PRD, API). Written in the vocabulary of the api story, chapter 11
(L26). The contract and `apps/api/openapi.json` are generated from
this file.

## Every endpoint

- Every reply is in the envelope (PRD, Envelope): the reply below is
  its `data`.
- Every object is closed: a field not listed is refused.
- Any request whose body is over `BODY_LIMIT_BYTES` (8192) is refused
  before routing: `too_large`.
- Any request can fail on the server: `internal`.
- A method and path not listed here: `not_found`.

Errors: `too_large`, `internal`

The errors under each endpoint are the ones it adds to these.

## Errors

- `validation`, with field
- `not_found`
- `limit`
- `too_large`
- `internal`

## Shapes

### `TodoReply`
A todo on the wire.
- `id`: text
- `title`: text
- `completed`: boolean

### `TodoListReply`
Todos in creation order.
list of `TodoReply`

## Endpoints

### `GET /health`
Serves: `prd/todo.md`, deviation 13 and scenario 1.

Reply: 200 `HealthReply`
- `ok`: literal `true`

Errors: none

### `GET /todos`
Serves: `use-cases/todos/list-todos.md`.

Query: `GetTodosQuery`
- `completed`: one of `"true"` `"false"`, optional "completed must be true or false"

Reply: 200 `TodoListReply`

Errors: `validation`

### `GET /todos/counts`
Serves: `use-cases/todos/count-todos.md`.

Reply: 200 `TodoCountsReply`
- `active`: integer, min 0
- `completed`: integer, min 0

Errors: none

### `POST /todos`
Serves: `use-cases/todos/add-a-todo.md`.

Body: `AddTodoBody`
- `title`: text "title must be text"

Reply: 201 `TodoReply`

Errors: `validation`, `limit`

### `PATCH /todos`
Serves: `use-cases/todos/mark-all-completed.md`.

Body: `PatchTodosBody`
- `completed`: boolean "completed must be true or false"

Reply: 200 `TodoListReply`

Errors: `validation`

### `PATCH /todos/{id}`
Serves: `use-cases/todos/change-a-todo.md`.

Path:
- `id`: text

Body: `PatchTodoBody`, at least 1 field "body must have title, completed or both"
- `title`: text, optional "title must be text"
- `completed`: boolean, optional "completed must be true or false"

Reply: 200 `TodoReply`

Errors: `validation`, `not_found`

### `DELETE /todos`
Serves: `use-cases/todos/clear-completed.md`.

Query: `DeleteTodosQuery`
- `completed`: literal `"true"` "completed must be true"

Reply: 200 `TodoListReply`

Errors: `validation`

### `DELETE /todos/{id}`
Serves: `use-cases/todos/remove-a-todo.md`.

Path:
- `id`: text

Reply: 200 `DeletedReply`
- `id`: text

Errors: `not_found`
