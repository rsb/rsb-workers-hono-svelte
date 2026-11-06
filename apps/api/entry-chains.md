Generated from apps/api/src/construct.ts by tooling/entry-chains/generate.ts. Do not edit: change the code and regenerate.

# Entry chains

Every entry point of the api, one block each: its entry chain on one
line, then one row per link, with the file and the exported symbols
that are the link. `→` is a direct call; `⇢` crosses a port, where
construct picks the implementation. A probe runs no unit, so its
block ends at the probe; a unit that declares no port reads nothing
of its own, so its block ends at the unit. Private symbols are not
links.

## Shared links

Every entry chain may pass through these. The gates run first, on
every request, in the order construct lists them; then each route
answers its unit's row with the runner's verdict before its handler.

```text
gates     apps/api/src/gates/request-id.ts                           requestId
gates     apps/api/src/gates/body-limit.ts                           bodyLimit
gates     apps/api/src/gates/channel.ts                              channel
gates     apps/api/src/gates/authenticate.ts                         authenticate
runner    packages/operations/src/run.ts                             run, verdict
http      apps/api/src/http.ts                                       serve
errors    apps/api/src/app/handlers/errors/errors.ts                 notFound, onError, tooLarge
handlers  apps/api/src/app/handlers/messages.ts                      invalidOf
handlers  apps/api/src/app/handlers/present.ts                       created, mapFailure, serverFailure, success, userFailure
handlers  apps/api/src/app/handlers/todos/present.ts                 presentTodo
handlers  apps/api/src/app/handlers/validate.ts                      validateBody, validateQuery
driver    packages/data/d1/src/driver.ts                             execute, queryAll, writeThenQueryAll
```

## GET /health

```text
GET /health → getHealth

route     apps/api/src/construct.ts                                  constructRoutes
probe     apps/api/src/app/handlers/health/health.ts                 getHealth
```

## GET /sessions/current

```text
GET /sessions/current → getCurrentSession → currentSession

use case  prd/todo/use-cases/auth/current-session.md
route     apps/api/src/construct.ts                                  constructRoutes
handler   apps/api/src/app/handlers/sessions/get-current-session.ts  getCurrentSession
op        packages/operations/src/auth/current-session.ts            currentSession
```

## GET /todos

```text
GET /todos → getTodos → listTodos ⇢ ListStore.listTodos → d1.listTodos

use case  prd/todo/use-cases/todos/list-todos.md
route     apps/api/src/construct.ts                                  constructRoutes
handler   apps/api/src/app/handlers/todos/get-todos.ts               getTodos
rules     packages/valid/src/todos/todo-filter.ts                    toTodoFilter
op        packages/operations/src/todos/list-todos.ts                listTodos, ListStore
data      packages/data/d1/src/todos.ts                              todoStore.listTodos
```

## GET /todos/counts

```text
GET /todos/counts → getTodoCounts → countTodos ⇢ CountStore.countTodos → d1.countTodos

use case  prd/todo/use-cases/todos/count-todos.md
route     apps/api/src/construct.ts                                  constructRoutes
handler   apps/api/src/app/handlers/todos/get-todo-counts.ts         getTodoCounts
op        packages/operations/src/todos/count-todos.ts               countTodos, CountStore
data      packages/data/d1/src/todos.ts                              todoStore.countTodos
```

## POST /todos

```text
POST /todos → postTodos → addTodo ⇢ AddStore.addTodoUnlessFull → d1.addTodoUnlessFull

use case  prd/todo/use-cases/todos/add-a-todo.md
route     apps/api/src/construct.ts                                  constructRoutes
handler   apps/api/src/app/handlers/todos/post-todos.ts              postTodos
rules     packages/valid/src/todos/new-todo.ts                       toNewTodo
op        packages/operations/src/todos/add-todo.ts                  addTodo, AddStore
data      packages/data/d1/src/todos.ts                              todoStore.addTodoUnlessFull
```

## PATCH /todos

```text
PATCH /todos → patchTodos → setAllCompleted ⇢ SetAllCompletedStore.setAllCompleted → d1.setAllCompleted

use case  prd/todo/use-cases/todos/mark-all-completed.md
route     apps/api/src/construct.ts                                  constructRoutes
handler   apps/api/src/app/handlers/todos/patch-todos.ts             patchTodos
rules     packages/valid/src/todos/completed.ts                      toCompleted
op        packages/operations/src/todos/set-all-completed.ts         setAllCompleted, SetAllCompletedStore
data      packages/data/d1/src/todos.ts                              todoStore.setAllCompleted
```

## PATCH /todos/{id}

```text
PATCH /todos/{id} → patchTodo → updateTodo ⇢ UpdateStore.updateTodo → d1.updateTodo

use case  prd/todo/use-cases/todos/change-a-todo.md
route     apps/api/src/construct.ts                                  constructRoutes
handler   apps/api/src/app/handlers/todos/patch-todo.ts              patchTodo
rules     packages/valid/src/todos/todo-patch.ts                     toTodoPatch
op        packages/operations/src/todos/update-todo.ts               updateTodo, UpdateStore
data      packages/data/d1/src/todos.ts                              todoStore.updateTodo
```

## DELETE /todos

```text
DELETE /todos → deleteTodos → deleteCompleted ⇢ DeleteCompletedStore.deleteCompleted → d1.deleteCompleted

use case  prd/todo/use-cases/todos/clear-completed.md
route     apps/api/src/construct.ts                                  constructRoutes
handler   apps/api/src/app/handlers/todos/delete-todos.ts            deleteTodos
op        packages/operations/src/todos/delete-completed.ts          deleteCompleted, DeleteCompletedStore
data      packages/data/d1/src/todos.ts                              todoStore.deleteCompleted
```

## DELETE /todos/{id}

```text
DELETE /todos/{id} → deleteTodo → deleteTodo ⇢ DeleteStore.deleteTodo → d1.deleteTodo

use case  prd/todo/use-cases/todos/remove-a-todo.md
route     apps/api/src/construct.ts                                  constructRoutes
handler   apps/api/src/app/handlers/todos/delete-todo.ts             deleteTodo
op        packages/operations/src/todos/delete-todo.ts               deleteTodo, DeleteStore
data      packages/data/d1/src/todos.ts                              todoStore.deleteTodo
```
