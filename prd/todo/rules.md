# Todo rules

The business rules of the todo app and the inputs they are applied to
(L29, L34). Written in the vocabulary of `api.md` (L26). Generated from
this file:
- `packages/business/src/rules.ts`: the constants and the rule table.
  It is the only home of `TITLE_MAX` and `TODO_LIMIT`; every other file,
  `todos/todo.ts` included, imports them from there.
- `packages/valid/src`: the `Problem` union, the validators, and the
  rules of form `length` and `at least`.
- `packages/business/rules-index.md`: the rules index.

A rule is defined here once. Use cases, the api spec and the data spec
cite it by id and never restate its words or numbers (L33). Wire rules,
such as `BODY_LIMIT_BYTES`, a closed object or a query given once, are
`api.md`'s and have no id here.

## Every input

- An input is decoded, its rules are applied, and it is built (L27).
- A field is decoded to its type first:
  - `text` is a string, as it is;
  - `boolean` is `true` or `false`, or the text `"true"` or `"false"`.

  Anything else is the decode problem `{ field, rule: "not_text" }` or
  `{ field, rule: "not_boolean" }`. Decode problems are not cited.
- A field marked `optional` that is not given (undefined) is not
  decoded, and the input is built without it. A field not marked
  `optional` is decoded even when it is not given.
- A field marked `trimmed` is trimmed after its decode and before its
  rules, as JavaScript's `String.prototype.trim` does. The input is
  built with the trimmed value.
- A field has at most one problem: the first one that fails, taking
  its decode first and then its rules in the order they are listed.
- The rules on the whole input are applied before any field. When one
  fails, its problem is the only one.
- Otherwise every field's problem is given, in the order the fields
  are listed.
- A problem carries:
  - its `rule`;
  - its `field`, when its rule is applied to a field;
  - its `violation`, when its rule is defined here;
  - every parameter of its rule.

  It carries no words; each delivery words it (L27).

### How an input is written
- A heading: the input's name.
- A line saying what it is.
- `Area:` the folder, under `packages/valid/src` and
  `packages/business/src`, that the input belongs to. Its validator is
  `<area>/<name in kebab case>.ts`.
- `Type:` the file under `packages/business/src` that exports a type
  of the input's name. The input is built as that type.
- Or, instead of `Type:`, `Builds:` the input's one field. The input
  is built as that field's value.
- `Rules:` (optional) the rules on the whole input, one id per item.
- `Fields:` the fields, in order. Each one is
  `` - `name`: type `` followed by `, trimmed` or `, optional` or both,
  in that order. The field's rules are listed under it, one id per
  item.

### How a rule is written
- A heading: its id, `<subject>.<property>`. Each part is lower-case
  words joined by `_`. The subject is `todo` for one todo and `todos`
  for the list.
- A line, the rule's statement.
- `Kind:` one of `input`, `state` or `guarantee` (L29).
- `Form:` (input rules only) how it is applied:
  - `` length, <least> to <most> ``: a text field's length, counted in
    UTF-16 code units. Each bound is a number or a parameter.
    Violation conditions: `below` (shorter than the least) and `above`
    (longer than the most).
  - `` at least <n> of <fields> ``: how many of the listed fields of
    the input are given. Violation condition: `fewer`.
  - `custom`: written by hand in
    `packages/valid/src/rules/<id, with . as ->.ts`, which exports the
    rule's id as `id`. The generator checks the file exists and
    exports the id; nothing more. Its violations have no condition.
- `Parameters:` (optional) each `` - `name`: CONSTANT ``. A problem of
  the rule carries each one, by name, with the constant's value.
- `Violations:` (input rules only) each
  `` - `name`: condition `` from the form.
- `Source:` where the rule comes from (L31): a PRD line or deviation,
  or a recorded decision, story chapter or registry entry.

## Constants

- `TITLE_MAX`: 256. The longest title, after trim.
- `TODO_LIMIT`: 500. The most todos the list holds.

## Inputs

### `NewTodo`
What someone asks to add.
Area: `todos`
Type: `todos/todo.ts`

Fields:
- `title`: text, trimmed
  - `title.length`

### `TodoPatch`
What someone asks to change in a todo. A field not given is not asked
to change.
Area: `todos`
Type: `todos/todo.ts`

Rules:
- `patch.nonempty`

Fields:
- `title`: text, trimmed, optional
  - `title.length`
- `completed`: boolean, optional

### `TodoFilter`
Which todos to list. No `completed` lists every todo.
Area: `todos`
Type: `todos/todo.ts`

Fields:
- `completed`: boolean, optional

### `Completed`
The `completed` every todo should take.
Area: `todos`
Builds: `completed`

Fields:
- `completed`: boolean

## Rules

### `title.length`
A title is 1 to `max` long, counted in UTF-16 code units.
Kind: input
Form: length, 1 to `max`

Parameters:
- `max`: `TITLE_MAX`

Violations:
- `empty`: below
- `too_long`: above

Source: PRD deviation 7.

### `patch.nonempty`
A patch gives a title, a `completed`, or both.
Kind: input
Form: at least 1 of `title`, `completed`

Violations:
- `empty`: fewer

Source: PRD › API, `PATCH /todos/:id` ("at least one").

### `todos.cap`
The list holds fewer than `limit` todos when one is added.
Kind: state

Parameters:
- `limit`: `TODO_LIMIT`

Source: PRD deviation 9.

### `todo.exists`
A todo has the id.
Kind: state

Source: PRD › API, `PATCH /todos/:id` and `DELETE /todos/:id` (404).

### `todos.order`
Every list the store returns is in the order todos were added.
Kind: guarantee

Source: DB6, story chapter 8 › The D1 package: every select orders by
`seq`.

### `todos.unique_id`
No two todos share an id.
Kind: guarantee

Source: story chapter 8, the guarantees (L29). The id is a UUID from
the id source (D13).
