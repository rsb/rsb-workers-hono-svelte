# The BFF story

> **Claude's first pass, for the owner to shape** (slice 2,
> 2026-10-31). The owner: "do you best to see where the api story also
> fits for the bff story, after all bff is half api." Nothing here is
> settled until the owner reviews it. Each chapter says what the code
> does today and what is only a candidate.

How the web Worker (SvelteKit, the BFF) is put together, told in the
order a request meets it. Chapters follow
[the api story](the-api-story.md) where they fit.

**[Kit]** marks a place where SvelteKit decides for us. The BFF chapter
on the page itself (chapter 9) has no counterpart in the api.

Paths are under `apps/todo/web/`. The decisions behind the slice 2
code are D18 and D19 in
[drafts/2026-10-31-04-slice-2-decisions.md](drafts/2026-10-31-04-slice-2-decisions.md).

```
src/
├─ routes/
│  ├─ +page.server.ts       load and the add action: one line each
│  ├─ +page.svelte          the page
│  └─ health/…              slice 1
└─ lib/server/
   ├─ api/                  the API through the binding (data)
   │  ├─ call.ts
   │  └─ todos.ts
   ├─ todos/                what each load and action does (entry points)
   │  ├─ load-todos.ts
   │  └─ add-todo.ts
   └─ health.ts             slice 1: entry point and data in one
```

## 1. Startup

The api has two halves, once per isolate and per request. The BFF has
them too, but **[Kit]** owns both:
- **Once per isolate:** the adapter's `_worker.js` builds the Kit
  server.
- **Per request:** Kit's `respond` runs its checks, then routes to a
  load or an action.

Our code can join each half through `hooks.server.ts`: `init` runs
once, and `handle` runs per request.

Today there is no `hooks.server.ts`, so nothing of ours runs in either
half.

Kit's own per-request half includes the origin check on form posts
(PRD, Security). It runs only in a build. Under `vite dev` it is
skipped (`if (!__SVELTEKIT_DEV__)`, findings 02).

**Candidate.** `hooks.server.ts` is where the two halves become ours
when we need them: `init` for something built once, and `handle` for
middleware (logging, F7).

## 2. `index.ts`

The api's story is read in `index.ts`. The BFF has no file of ours in
that place. **[Kit]** owns the entry (`.svelte-kit/cloudflare/_worker.js`).
The nearest things to a story are:
- `hooks.server.ts`, if it existed (chapter 1);
- the `src/routes/` tree, which **[Kit]** turns into the route table.
  That is the BFF's equivalent of construct's route table.

**Candidate.** There is no story file, because the route tree is the
story. Whether the BFF needs a written story somewhere is the owner's
call.

## 3. Config

The BFF's only environment value is the `API` binding. It comes from
`env`, which is imported from `cloudflare:workers`, because
adapter-cloudflare 8 has no `event.platform` (F2, P29). Wrangler
generates and checks its type.

Nothing validates or freezes it: the type is the check.

**Candidate.** Config as the api story describes it does not exist
here. The binding is what config would hold, and it is imported where
it is used.

## 4. Construct

The api builds every object once. The BFF builds nothing:
- Each `+page.server.ts` passes `env.API` to a `#lib/server` function
  on every call.
- Those functions take the binding as a parameter, so the unit tier
  can hand them a fake (P29).

**Candidate.** "Build the API client from `env.API` once" would need a
module-level object in `#lib/server`, built at import time, which is
the api's construct in miniature. Today the client is plain functions
that take the binding, so there is nothing to build. Construct
arrives when the client has state (a base URL, a logger), not before.

**Target (A10, refactor B).** When the bff-api gets its construct, it
follows the api's (api story, chapter 4):
- Everything the bff-api builds lives in its one construct, in
  `$lib/server/`. No shared construct package, and no builders inside
  `data/internal/api` or the operations packages.
- One exported builder per level, composed into a default chain:
  infra (the `API` binding, a logger) → data (the api client) →
  operations, when the BFF has any (chapter 6) → handlers (the load
  and action functions).
- Tests enter at any level: a fake binding at the infra level, which
  replaces today's habit of passing the binding to every function
  (P29), or a stubbed client one level up.
- **[Kit]** still owns the route table, so there is no routes level.
  The open question is how a `+page.server.ts` reaches the built
  handlers: a module-level `construct()` in `$lib/server`, or Kit's
  `init` hook (chapter 1).

## 5. Entry points

**[Kit]** owns the files: `load` and form actions live in
`+page.server.ts`. Each is one line that hands `env.API` to a function
in `#lib/server/todos/`, which is where the four duties are:

| Duty | `addTodo(api, form)` (`lib/server/todos/add-todo.ts`) |
|---|---|
| Validate | `AddTodoBody` from contract: the same rule, defined once, that the api applies |
| Operate | `postTodo(api, body)`, the API client |
| Handle errors | a `Failure` envelope becomes `fail(status, { title, message })`. The status map is the BFF's own: `validation` 422, `limit` 409, else 500 |
| Present | `{ added: title }`; the page re-reads the list |

`loadTodos(api)` has no input to validate. Its error duty returns the
failure as page data (`{ todos: [], error }`), never `error()`.
Errors on the request path are values in the BFF too.

Why the one-line route file: a load or action cannot be handed a fake
binding (F2). So the duties live in a function that can, and the
route file only wires `env.API` to it. That route file is the BFF's
construct, one route at a time.

**Open.**
- `readHealth` (slice 1) is entry point and data in one file. Should
  it split like todos?
- The BFF's kind → status map partly repeats the api's (P28). Is that
  one map in contract, or two maps with different jobs? The api's map
  sets the API's status; the BFF's sets the status of the page
  response.

## 6. Operations

The BFF has none yet. Each entry point calls the API client directly.
Under the api story's rules that is `handlers → data`, an edge the api
does not allow.

**Candidate.**
- An operation appears when the BFF does work of its own. The first
  is slice 8's filtering on `/`, which reads the full list and filters
  it in the BFF (deviation 5).
- Until then, the BFF's edges are `entry points → data → contract`.

## 7. Business

The BFF's business types are contract's: `TodoReply`, and the
envelope as its result type. The BFF has:
- no `Result` of its own, because the envelope already is one;
- no `Todo` of its own, because nothing in the BFF needs more than the
  wire shape.

**Candidate.** Business here is contract. If the page ever needs a
shape the wire does not have (for example, a todo with an "editing"
flag), that is the BFF's first business type of its own, and it lives
in `#lib`.

## 8. Data

The BFF's one real thing is the API, reached through the binding.
`#lib/server/api/` is its data package:
- `call.ts`:
  - fetches through the binding;
  - parses the envelope with a contract schema;
  - turns every way the call can go wrong (binding failure, a body
    that is not JSON, a body that is not the envelope) into a
    `Failure` of kind `internal`.

  The body decides, not the status, so a 2xx `Failure` is a failure.
- `todos.ts`: one function per API route it calls (`getTodos`,
  `postTodo`), named after the route as the api's handlers are.

Data maps the wire to the BFF's business objects. They are the same
types today (chapter 7), so the mapping is the schema parse.

**Open.**
- `call.ts` needs one cast, because TypeScript cannot reduce valibot's
  generic object output (findings 02).
- The BFF still logs nothing when the API is unreachable (F7).

## 9. The page (BFF only)

The api has no presentation beyond JSON. The BFF has a second
presentation layer: the `.svelte` component that renders page data.
`src/routes/+page.svelte`:
- renders `data.todos` as a list, and no list when there are none
  (scenario 2.1);
- has a form that posts to `?/add` with `use:enhance`. Without
  JavaScript it is a plain form post, and with JavaScript Kit resets
  the form on success and re-reads the list;
- has an input with `autofocus`, which upstream asks for. The a11y
  warning is silenced with a comment that cites upstream;
- shows `form.message` and `data.error` in a `role="alert"`
  paragraph;
- never uses `{@html}` (PRD, Security).

**Candidate.** The component's duties mirror the api's present step:
it maps page data to markup and has no logic of its own. Logic that
appears here (editing state in slice 4) is the first test of whether
the page gets its own `.svelte.ts` modules in `#lib`.

## 10. The shape of the code

**[Kit]** fixes `src/routes/`: file-based routing decides its layout,
and its files are named by Kit (`+page.server.ts`). The hierarchy rules
can apply only to `src/lib/`.

Today `src/lib/server/` has two layers by role (`api/` for data,
`todos/` for entry-point logic), plus `health.ts` from slice 1.

**Candidate.**
- The api story's rules, applied to `src/lib/`:
  - a package is a directory;
  - `todos/ → api/`, and `api/ → contract`;
  - nothing in `lib` imports a route;
  - only `+page.server.ts` imports `cloudflare:workers` (P29).
- Whether `src/lib/server/` gets the api's layer names (`handlers/`,
  `data/`) or keeps names that say what each holds (`api/` is the
  API) is open for the owner.
