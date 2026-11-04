<!-- Generated from prd/todo/rules.md and the use cases under prd/todo/use-cases by tooling/rules/generate.ts. Do not edit: change the spec and regenerate. -->

# Rules index

Every rule [`prd/todo/rules.md`](../../prd/todo/rules.md) defines: its kind, its
source, the validators that apply it and the use cases that cite it
(L29, L33, L34). State rules and guarantees are enforced by operations
and the store, which do not declare them yet.

| Rule | Kind | Applied by | Cited by |
|------|------|------------|----------|
| `title.length` | input | `toNewTodo`, `toTodoPatch` | Add a todo, Change a todo |
| `patch.nonempty` | input | `toTodoPatch` | Change a todo |
| `todos.cap` | state | none | Add a todo |
| `todo.exists` | state | none | Change a todo, Remove a todo |
| `todos.order` | guarantee | none | Add a todo, Clear completed, List todos, Mark all completed |
| `todos.unique_id` | guarantee | none | Add a todo |

## `title.length`
A title is 1 to `max` long, counted in UTF-16 code units.

- Kind: input
- Form: length, 1 to `max`
- Parameters: `max` is `TITLE_MAX`, 256
- Violations: `empty` (below), `too_long` (above)
- Source: PRD deviation 7.
- Applied by:
  - `toNewTodo` in [`packages/valid/src/todos/new-todo.ts`](../valid/src/todos/new-todo.ts), to `title`
  - `toTodoPatch` in [`packages/valid/src/todos/todo-patch.ts`](../valid/src/todos/todo-patch.ts), to `title`
- Cited by:
  - [Add a todo](../../prd/todo/use-cases/todos/add-a-todo.md), Assumes
  - [Change a todo](../../prd/todo/use-cases/todos/change-a-todo.md), Assumes

## `patch.nonempty`
A patch gives a title, a `completed`, or both.

- Kind: input
- Form: at least 1 of `title`, `completed`
- Violations: `empty` (fewer)
- Source: PRD › API, `PATCH /todos/:id` ("at least one").
- Applied by:
  - `toTodoPatch` in [`packages/valid/src/todos/todo-patch.ts`](../valid/src/todos/todo-patch.ts), to the whole input
- Cited by:
  - [Change a todo](../../prd/todo/use-cases/todos/change-a-todo.md), Assumes

## `todos.cap`
The list holds fewer than `limit` todos when one is added.

- Kind: state
- Parameters: `limit` is `TODO_LIMIT`, 500
- Source: PRD deviation 9.
- Cited by:
  - [Add a todo](../../prd/todo/use-cases/todos/add-a-todo.md), Given

## `todo.exists`
A todo has the id.

- Kind: state
- Source: PRD › API, `PATCH /todos/:id` and `DELETE /todos/:id` (404).
- Cited by:
  - [Change a todo](../../prd/todo/use-cases/todos/change-a-todo.md), Given
  - [Remove a todo](../../prd/todo/use-cases/todos/remove-a-todo.md), Given

## `todos.order`
Every list the store returns is in the order todos were added.

- Kind: guarantee
- Source: DB6, story chapter 8 › The D1 package: every select orders by `seq`.
- Cited by:
  - [Add a todo](../../prd/todo/use-cases/todos/add-a-todo.md), Guarantees
  - [Clear completed](../../prd/todo/use-cases/todos/clear-completed.md), Guarantees
  - [List todos](../../prd/todo/use-cases/todos/list-todos.md), Guarantees
  - [Mark all completed](../../prd/todo/use-cases/todos/mark-all-completed.md), Guarantees

## `todos.unique_id`
No two todos share an id.

- Kind: guarantee
- Source: story chapter 8, the guarantees (L29). The id is a UUID from the id source (D13).
- Cited by:
  - [Add a todo](../../prd/todo/use-cases/todos/add-a-todo.md), Guarantees
