# Todo api

The `todo-api` Worker, reached only through the BFF's `API` binding
(PRD, Shape). Written in the vocabulary of the api story, chapter 11
(L26). The contract and `apps/api/openapi.json` are generated from
this file. Since stage 22 it is also the home of what the PRD root's
API section held (L44).

What a use case refuses reaches the wire as the kind of the same name:
`limit`, `not_found` and `invalid_credentials`. Its `unavailable` and `server` reach the wire
as `internal`. Use cases and features cite the use case's kinds; this
paragraph is the one place they are mapped to the envelope's.

A body that is not JSON is refused as `validation`, with the field
`body`, by every endpoint that takes a body.

## Every endpoint

- Every reply is in the envelope (PRD, Envelope): the reply below is
  its `data`.
- Every object is closed: a field not listed is refused.
- Any request whose body is over `BODY_LIMIT_BYTES` (8192) is refused
  before routing: `too_large`.
- Any request that changes something and does not carry a bearer token,
  with the session cookie or without it, is refused unless it comes from
  the BFF's own page: `Sec-Fetch-Site` is `same-origin` or `none`, or,
  without it, `Origin` is the BFF's. Its body, if it has one, is
  `application/json`. Otherwise: `forbidden`, reason `channel` (L38,
  amended by L49 so a sign-in, which has no cookie yet, is checked too).
- Any request whose bearer token names no live session, or that gives a
  cookie and a bearer token together: `unauthenticated`. A cookie that
  names no live session is not refused: the request is anonymous (L39).
- Any request whose live session is a disabled user's: `forbidden`,
  reason `account_disabled` (L39).
- Any request whose operation's row in `access.md` refuses its actor,
  before the operation's body runs (L43): an anonymous actor,
  `unauthenticated`; a signed-in one below the row, `forbidden`, reason
  `role`. Each endpoint's `Security:` names the least actor its row
  requires; every todo endpoint requires a member. The refusal comes
  before the request's query or body is read, so a request refused
  this way is never told its input was invalid.
- Any request can fail on the server: `internal`.
- A method and path not listed here: `not_found`.

Errors: `unauthenticated`, `forbidden`, `too_large`, `internal`

The errors under each endpoint are the ones it adds to these.

Examples:

Example: a body over the limit
Reply: 413
```json
{
  "ok": false,
  "error": {
    "kind": "too_large",
    "message": "request body too large"
  }
}
```

Example: a bearer token that names no session
Reply: 401
```json
{
  "ok": false,
  "error": {
    "kind": "unauthenticated",
    "message": "the bearer token names no live session"
  }
}
```

Example: a change from another site, with the session cookie
Reply: 403
```json
{
  "ok": false,
  "error": {
    "kind": "forbidden",
    "message": "the request does not come from the BFF's page",
    "reason": "channel"
  }
}
```

Example: the server fails
Reply: 500
```json
{
  "ok": false,
  "error": {
    "kind": "internal",
    "message": "internal error"
  }
}
```

## Errors

- `validation`: 422, with field
- `unauthenticated`: 401
- `invalid_credentials`: 401
- `forbidden`: 403, with reason: channel | account_disabled | role
- `not_found`: 404
- `limit`: 409
- `too_large`: 413
- `internal`: 500

## Shapes

### `TodoReply`
A todo on the wire.
- `id`: text
- `title`: text
- `completed`: boolean

### `TodoListReply`
Todos in creation order.
list of `TodoReply`

### `SessionUser`
The signed-in user a request acts for, with what the frame shows.
- `id`: text
- `role`: one of `"member"` `"admin"`
- `emailVerified`: boolean
- `name`: text
- `email`: text

## Endpoints

### `GET /health`
Serves: `prd/todo.md`, deviation 13 and scenario 1.
Security: `anonymous`

Reply: 200 `HealthReply`
- `ok`: literal `true`

Errors: none

Examples:

Example: the api is up
Request: `GET /health`
Reply: 200
```json
{
  "ok": true,
  "data": {
    "ok": true
  }
}
```

### `GET /sessions/current`
Serves: `use-cases/auth/current-session.md`.
Applies: none
Security: `anonymous`

Reply: 200 `SessionReply`
- `user`: `SessionUser`, optional
- `clearCookie`: boolean

Errors: none

Examples:

Example: no one is signed in
Request: `GET /sessions/current`
Reply: 200
```json
{
  "ok": true,
  "data": {
    "clearCookie": false
  }
}
```

Example: a member is signed in
Request: `GET /sessions/current`
Reply: 200
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "u-member",
      "role": "member",
      "emailVerified": true,
      "name": "Ada Lovelace",
      "email": "ada@example.com"
    },
    "clearCookie": false
  }
}
```

Example: the session cookie names no live session
Request: `GET /sessions/current`
Reply: 200
```json
{
  "ok": true,
  "data": {
    "clearCookie": true
  }
}
```

### `GET /todos`
Serves: `use-cases/todos/list-todos.md`.
Applies: none
Security: `member`

Query: `GetTodosQuery`
- `completed`: one of `"true"` `"false"`, optional "completed must be true or false"

Reply: 200 `TodoListReply`

Errors: `validation`

Examples:

Example: lists every todo
Request: `GET /todos`
Reply: 200
```json
{
  "ok": true,
  "data": [
    {
      "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
      "title": "Buy milk",
      "completed": false
    },
    {
      "id": "5d2a9c7e-1f3b-4e8a-b6d4-7c9e0a1f2b3c",
      "title": "Post the letter",
      "completed": true
    }
  ]
}
```

Example: lists the completed todos
Request: `GET /todos?completed=true`
Reply: 200
```json
{
  "ok": true,
  "data": [
    {
      "id": "5d2a9c7e-1f3b-4e8a-b6d4-7c9e0a1f2b3c",
      "title": "Post the letter",
      "completed": true
    }
  ]
}
```

Example: completed is not true or false
Request: `GET /todos?completed=yes`
Reply: 422
```json
{
  "ok": false,
  "error": {
    "kind": "validation",
    "message": "completed must be true or false",
    "field": "completed"
  }
}
```

Example: completed is given twice
Request: `GET /todos?completed=true&completed=false`
Reply: 422
```json
{
  "ok": false,
  "error": {
    "kind": "validation",
    "message": "completed must be given once",
    "field": "completed"
  }
}
```

### `GET /todos/counts`
Serves: `use-cases/todos/count-todos.md`.
Applies: none
Security: `member`

Reply: 200 `TodoCountsReply`
- `active`: integer, min 0
- `completed`: integer, min 0

Errors: none

Examples:

Example: counts the todos
Request: `GET /todos/counts`
Reply: 200
```json
{
  "ok": true,
  "data": {
    "active": 1,
    "completed": 1
  }
}
```

### `POST /todos`
Serves: `use-cases/todos/add-a-todo.md`.
Applies: `title.length`
Security: `member`

Body: `AddTodoBody`
- `title`: text "title must be text"

Reply: 201 `TodoReply`

Errors: `validation`, `limit`

Examples:

Example: adds a todo
Request: `POST /todos`
```json
{
  "title": "Buy milk"
}
```
Reply: 201
```json
{
  "ok": true,
  "data": {
    "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
    "title": "Buy milk",
    "completed": false
  }
}
```

Example: the title is not text
Request: `POST /todos`
```json
{
  "title": 3
}
```
Reply: 422
```json
{
  "ok": false,
  "error": {
    "kind": "validation",
    "message": "title must be text",
    "field": "title"
  }
}
```

Example: the title is empty
Request: `POST /todos`
```json
{
  "title": ""
}
```
Reply: 422
```json
{
  "ok": false,
  "error": {
    "kind": "validation",
    "message": "title is empty",
    "field": "title"
  }
}
```

Example: the list is full
Request: `POST /todos`
```json
{
  "title": "Buy milk"
}
```
Reply: 409
```json
{
  "ok": false,
  "error": {
    "kind": "limit",
    "message": "the list is full"
  }
}
```

### `PATCH /todos`
Serves: `use-cases/todos/mark-all-completed.md`.
Applies: none
Security: `member`

Body: `PatchTodosBody`
- `completed`: boolean "completed must be true or false"

Reply: 200 `TodoListReply`

Errors: `validation`

Examples:

Example: marks every todo completed
Request: `PATCH /todos`
```json
{
  "completed": true
}
```
Reply: 200
```json
{
  "ok": true,
  "data": [
    {
      "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
      "title": "Buy milk",
      "completed": true
    },
    {
      "id": "5d2a9c7e-1f3b-4e8a-b6d4-7c9e0a1f2b3c",
      "title": "Post the letter",
      "completed": true
    }
  ]
}
```

Example: completed is not a boolean
Request: `PATCH /todos`
```json
{
  "completed": "yes"
}
```
Reply: 422
```json
{
  "ok": false,
  "error": {
    "kind": "validation",
    "message": "completed must be true or false",
    "field": "completed"
  }
}
```

### `PATCH /todos/{id}`
Serves: `use-cases/todos/change-a-todo.md`.
Applies: `patch.nonempty`, `title.length`
Security: `member`

Path:
- `id`: text

Body: `PatchTodoBody`, at least 1 field "body must have title, completed or both"
- `title`: text, optional "title must be text"
- `completed`: boolean, optional "completed must be true or false"

Reply: 200 `TodoReply`

Errors: `validation`, `not_found`

Examples:

Example: renames a todo
Request: `PATCH /todos/0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90`
```json
{
  "title": "Buy oat milk"
}
```
Reply: 200
```json
{
  "ok": true,
  "data": {
    "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
    "title": "Buy oat milk",
    "completed": false
  }
}
```

Example: the body is empty
Request: `PATCH /todos/0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90`
```json
{}
```
Reply: 422
```json
{
  "ok": false,
  "error": {
    "kind": "validation",
    "message": "body must have title, completed or both",
    "field": "body"
  }
}
```

Example: no todo has the id
Request: `PATCH /todos/missing`
```json
{
  "completed": true
}
```
Reply: 404
```json
{
  "ok": false,
  "error": {
    "kind": "not_found",
    "message": "no todo has id missing"
  }
}
```

### `DELETE /todos`
Serves: `use-cases/todos/clear-completed.md`.
Applies: none
Security: `member`

Query: `DeleteTodosQuery`
- `completed`: literal `"true"` "completed must be true"

Reply: 200 `TodoListReply`

Errors: `validation`

Examples:

Example: clears the completed todos
Request: `DELETE /todos?completed=true`
Reply: 200
```json
{
  "ok": true,
  "data": [
    {
      "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
      "title": "Buy milk",
      "completed": false
    }
  ]
}
```

Example: completed is not true
Request: `DELETE /todos?completed=false`
Reply: 422
```json
{
  "ok": false,
  "error": {
    "kind": "validation",
    "message": "completed must be true",
    "field": "completed"
  }
}
```

### `DELETE /todos/{id}`
Serves: `use-cases/todos/remove-a-todo.md`.
Applies: none
Security: `member`

Path:
- `id`: text

Reply: 200 `DeletedReply`
- `id`: text

Errors: `not_found`

Examples:

Example: removes a todo
Request: `DELETE /todos/0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90`
Reply: 200
```json
{
  "ok": true,
  "data": {
    "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90"
  }
}
```

Example: no todo has the id
Request: `DELETE /todos/missing`
Reply: 404
```json
{
  "ok": false,
  "error": {
    "kind": "not_found",
    "message": "no todo has id missing"
  }
}
```
