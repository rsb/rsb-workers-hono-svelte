# Glossary

The words we use to talk about apps on this stack. Each term says what
it means here, how it relates to Domain-Driven Design, where it lives
in the code and whether it is settled.

We ground our language in DDD's concepts, with two cautions:
- **Its code, not its concepts.** DDD examples are object-oriented:
  repositories, services and aggregates that guard their own state.
  Our code is functions and types arranged in an entry chain, so where
  a DDD term would bring an OO shape with it, we keep the idea and say
  how we realize it.
- **Performance is a design input (L11).** We take a DDD concept only
  when it costs nothing at run time or pays for what it costs: one
  intent per port, plain types rather than hydrated objects, and one
  translation per boundary.

Decisions L1–L27 were agreed in the language sessions of 2026-11-03:
L1–L13 on language, L14–L21 on operations, L22 on package layout, L23
on OpenAPI, L24 on entry chains, L25 on use cases, L26 on the api
spec, L27 on `valid`. They are recorded
in [the api story](the-api-story.md).

Status:
- **locked:** agreed, and the story follows it;
- **target:** agreed, and the code does not follow it yet;
- **pending:** agreed as a trial, to be kept or dropped once tried;
- **not used:** a DDD term we deliberately do without;
- **retired:** a word we used and no longer use;
- **open:** still under discussion.

## The entry chain

### Entry chain

The path every request takes:
startup → entry point → [process →] operation (using business) → port
← data. Construct does the wiring. Each link has one role, and a
request cannot skip a link. A process is there only when the use case
needs one.

- **DDD:** layered architecture, with the domain at the centre.
- **We differ:** the boundary is kept by the architecture (checked
  imports and tests), not by encapsulation. Each link can be tested on
  its own, with or without a mock, and in every test category.
- **Status:** locked (L2, L18). Called *chain* until L24; in file and
  identifier names it is `entry-chains`.

An entry chain is written in one line of exported symbols, `→` for a
direct call and `⇢` across a port, where construct picks the
implementation:

```
PATCH /todos/:id → patchTodo → updateTodo ⇢ UpdateStore.updateTodo → d1.updateTodo → queryAll
```

Every entry point's entry chain, with the file and symbols of each
link, is listed in `apps/api/entry-chains.md`. The index is generated, never
written by hand, and checked by regenerating and diffing it. See
[the api story](the-api-story.md), chapter 9.

- **Status:** target (L24). The generator is open.

### Boundary

The line between two links of an entry chain. What may cross it, and
in which direction, is fixed by `package.json` dependencies and checked
by tests.

- **DDD:** the line between layers. It is not a bounded context,
  which is a whole system with its own language.
- **Status:** locked (L2).

### Seam

The point where one link calls the next. Our seams are shaped by the
caller:
- an entry point calls an operation or a process with business inputs;
- a process calls operations;
- an operation calls a port declared for what it needs.

Ports are coupled to business types on purpose. Because the seams
matter this much, we build in vertical slices, so each seam is made
for the work that uses it.

- **Status:** locked (L6).

### Entry point

A handler. It turns loose input into well-defined business inputs,
runs exactly one unit, an operation or a process, handles its failures
and presents its result. Never both, never neither: a route with no
unit to run is a probe, not an entry point. See
[the api story](the-api-story.md), chapter 5.

Lives in `app/handlers/`.

- **DDD:** application layer, inbound adapter.
- **Status:** locked (L19).

### Probe

A check of the Worker and its dependencies: liveness (is the Worker
up?) and readiness (can it reach its store?). A probe completes no
business task, so it runs no unit. When it needs to reach a
dependency, it declares a probe port of its own (`ping()`), which data
satisfies cheaply (`SELECT 1`).

A probe never uses an operation's port or a business action. It must
be cheap, since it may be called often: for a paid or rate-limited
provider it checks configuration or the provider's status, and never
sends anything. A public probe answers up or down; the detail goes to
the logs.

Lives in `app/probes/`. `health` is today's liveness probe.

- **DDD:** none. It is operational, not business.
- **Status:** target (L20). Today `health` sits in `app/handlers/`.

### Errors

Failure presentation, shared by handlers and probes: not-found and
on-error. Lives in `app/errors/`.

- **Status:** target (L20). Today it sits in `app/handlers/errors/`.

### Validate once

The entry point validates input against the wire shape and the
business rules, which it may import, and builds the input shape from
the result. A single property is checked as a property: the title
against `TITLE_MAX`. No new type is needed for that.

It does so in three steps (L27): it decodes its own envelope, calls
`valid`, which turns a candidate into the input, then words any
problem in its own message table. The [check](#check) runs once, in
`valid`, for every delivery.

- **Status:** locked (L12, L27).

### Trusted

What everything below the entry point is. A process, an operation, a
port and data receive input the entry point has already validated, and
do not check it again. Rows read back from our own store are trusted
too.

- **Status:** locked (L12).

### Process

Composes operations into one business flow. It holds their order and
their dependencies (the first operation's result decides whether the
next ones run), handles their failures as its spec says (stop,
continue, retry, compensate) and returns one result.

A process:
- never touches a port; every effect happens in an operation;
- enforces no business rule; it decides flow only;
- has no atomic scope: each operation commits on its own, so undoing a
  step is an operation too (a compensation);
- runs in one of two modes, chosen by its spec:
  - **immediate:** inside the request. It is fast and returns the
    whole result, but a step after a crash is lost;
  - **durable:** on a runner that keeps each step's result and retries
    (Cloudflare Workflows). Every step runs, but the request cannot
    wait for all of them. How it runs there is the workflow story's;
- receives built operations from construct, so its tests mock
  operations only.

Processes do not call processes.

Lives in `packages/processes`, in the folder of the area whose use
case triggers it. It imports operations' types only (`import type`),
and `packages/operations` never imports it.

- **DDD:** process manager (also called a saga).
- **Not called:** workflow (rsb-workflow and Cloudflare Workflows use
  the word), saga (suggests compensation only), pipeline (suggests a
  straight line).
- **Status:** target (L18, L22). The todo app's first process is
  "notify on add".

### Operation

A business use case. "Use case" reads oddly in code, so the code says
operation, but that is what it is. Each one is driven by its spec.

An operation is the only place anything happens to an entity. It
takes business inputs, enforces the business rules, and composes
entity behaviour with the actions of one or more ports. It may have
several effects and returns one result. A different result is a new
operation, which may reuse the same entity behaviour.

A light operation is fine. A use case that only reads still has an
operation, so the rule "only operations and probes call ports" has no
exception, and logic that arrives later (list *my* todos) has a place
to go. `listTodos` is one.

Operations do not call operations. Shared work is entity behaviour or
a shared action; a sequence of operations is a process.

Lives in `packages/operations`, in its area's folder, one file per
operation with its ports. It may use any area's business objects: a
rule that spans two areas' entities is its job.

- **DDD:** application service, and also the job of the aggregate
  (guarding a rule across several entities).
- **We differ:** it is a function, not a service object, and it holds
  no state.
- **Status:** locked (L1, L4, L5, L14, L22).

### Use case

What the business needs done, written down before any code, at
`prd/<app>/use-cases/<area>/<name>.md`. It cites the PRD and never
edits it. It is the spec of the one unit that realizes it, an
operation or a process, and that unit's doc comment cites its path.

It states the intent and the PRD sentences it serves, the input, the
rules, what must hold together (under concurrency too), the effects
and whether each must be delivered, the result and the failures. It is
written for the developer, so it may speak of databases, transactions,
concurrency and queues, but it names no code. Its name is a hint and a
search key, not the unit's name.

- **DDD:** use case, as in application services.
- **Status:** locked (L25). Each todo operation's doc comment cites
  its use case.

### Spec

What drives a use case. An operation's spec states its intent, input,
the rules it enforces, the action that carries its decision and what
it keeps atomic, its effects (for each external one: inline or
recorded, and what its failure does to the result), its result and its
failures. A process's spec states its steps, their dependencies, the
failure policy for each step, its mode and its result.

A light operation's spec is a few lines.

- **Status:** locked (L14) that a spec drives each use case. Its form
  is the use case file (L25). How specs enter rsb-workflow is parked.

### Port

The interface a caller declares for what it needs from the world. It
is owned by its caller, speaks business types and returns a `Result`.
Only operations and probes declare ports.

Its methods are actions.

- **DDD:** repository.
- **We differ:** no repository per entity and no generic CRUD. Each
  operation declares the smallest port it needs, one per real thing it
  touches (a store, a mailer), and one flat store satisfies them all.

A port may carry out behaviour for its operation: a patch, a bulk
update, counts. The operation still owns the decision. If performance
moves behaviour away from where it would otherwise live, a comment
there says what moved and why.

- **Status:** locked (L6, L13, L15, L20).

### Data

The concrete world, one package per real thing. It satisfies ports,
maps business objects to its own representation and back, and reports
facts. It makes no ids and decides no rules.

- **DDD:** infrastructure, repository implementation.
- **Status:** locked.

### Area

A part of the business inside one system, such as `todos` or `users`.
It is a folder in each layer, `business`, `operations` and
`processes`, not a package of its own. Areas share one language and
one store.

- Siblings never import each other within a layer: no business area
  imports another, and no operation imports another. Areas meet in an
  operation or a process, which may use any area's business objects.
- An entity refers to another area's entity by id.
- An area becomes its own package only by recorded exception: a
  second app needs only some areas, a team owns it, or the package's
  check or test time hurts.
- Data is split by engine or external system, never by area.

- **DDD:** a module. It is not a bounded context: a bounded context is
  a whole system with its own language. If two areas start to mean
  different things by the same word, they have become two systems.
- **Status:** locked (L22).

## Effects

### Action

A method on a port: how an operation asks the world for one thing.
Named for intent, as the caller needs it: `addTodoUnlessFull(todo,
limit)`, `insertTodo(todo)`, `sendEmail(message)`. A probe's actions
are probe actions (`ping()`), never business ones.

- **Status:** locked (L15).

### Effect

A change an operation makes in the world: a row written, an email
sent, a text sent. An operation may have several. Two kinds:
- **atomic:** a store action inside the operation's transaction scope;
- **external:** anything else. It cannot be rolled back, so it never
  runs inside the scope. The spec chooses, for each one:
  - **inline:** done after the commit, best effort. The operation
    knows how it went, and the spec says whether a failure fails the
    result;
  - **recorded:** written as an outbox row inside the transaction and
    delivered later, at least once. It cannot fail the result, since
    it has not happened yet.

- **Status:** locked (L15, L17).

### Result

The one thing an operation or a process returns: a value or a failure.
Every operation and process returns `Result<T, AnyFail>`.

- **Status:** locked (L15).

### Outcome

Retired. It meant both the result and the effects. We now say which.

- **Status:** retired (L15).

### Outbox

Rows that record external effects inside the operation's transaction,
so the decision and the intent to notify commit together or not at
all. A relay delivers them later and marks them done. Delivery is at
least once, so the outbox row's id is the idempotency key, passed to
the provider where it takes one.

The relay is a process: its trigger (a queue message, a cron sweep) is
an entry point, and each delivery is an operation.

- **DDD:** none; it is the transactional outbox pattern.
- **Status:** target (L17). Nothing in the todo app records an effect
  yet.

## Rules

### Rule

A business truth: a type, a constant or a pure function. `TITLE_MAX`
and `TODO_LIMIT` are rules. Business *states* rules and never enforces
them.

- **DDD:** invariant, business rule.
- **We differ:** DDD puts the invariant inside the aggregate, which
  both states and enforces it. We split the two.
- **Status:** locked (L1).

### Enforce

To apply a rule to a real case and decide the result. Only operations
enforce. `addTodo` enforces `TODO_LIMIT`.

- **Status:** locked (L1).

### Atomic

What the store promises an operation: its decision is kept whole, with
no other request landing in the middle. How it is kept depends on the
engine:
- D1 (SQLite) runs one write at a time, so one statement is atomic;
- Postgres needs a lock, an advisory lock or a serializable
  transaction.

The store promises atomicity, and the story does not depend on how it
is kept. An operation gets it in one of two ways: a transaction scope,
or a single intent action.

- **DDD:** the aggregate's consistency boundary.
- **Status:** locked (L1, L7). How Postgres keeps it, and at what
  cost, is open: it needs experiments.

### Transaction scope

The operation marks where its transaction starts and what rolls it
back; the port does all of the work. The operation hands its work to
the port, and the port runs it inside a transaction:

```ts
const added = await dbStore.transaction(async (tx) => {
  const count = await tx.countTodos();
  if (!count.ok) {
    return count;
  }
  if (count.value >= TODO_LIMIT) {
    return limitReached("the list is full");
  }
  …
});
```

The port:
- begins when `transaction` is called;
- commits if the work returns `ok`;
- rolls back if the work returns a failure, so the operation decides
  by returning, not by throwing;
- rolls back and reports a failure if anything throws.

Inside the work, `tx` is still the operation's smallest port. Only one
store's actions run there; external effects never do. The work is
short, since it holds locks across round trips. The spec states the
isolation the operation needs.

The alternative is a single intent action (`addTodoUnlessFull`): one
round trip, with the decision carried out by the store (L13). The spec
says which one the operation uses.

- **DDD:** unit of work, without the object.
- **Status:** target (L16). D1 cannot offer it: it has no interactive
  transactions, only `batch()`. Postgres over Hyperdrive can; that
  needs experiments.

### Fact

What a store answers: what happened, not what it means. "Not
inserted" is a fact. The operation decides that it means the list is
full.

- **Status:** locked (L1).

## Business

### Entity

A business type with identity: it stays the same thing while its
values change. `Todo` is an entity, known by its `id`. Two todos with
the same title are still two todos.

Named plainly, with no suffix: `Todo`, never `TodoEntity`.

An entity refers to an entity of another area by id, never by holding
it: a `Todo` would hold `assigneeId`, not a `User` (L22).

- **DDD:** entity.
- **We differ:** a type plus functions beside it, not a class.
- **Status:** locked (L3). Its package, `business/entity`, is a
  target.

### Entity behaviour

Pure business logic about an entity, which lives beside it.
`newTodo(id, input)` is entity behaviour: a new todo is not completed.
Operations compose entity behaviour with actions to produce their
effects and result. Behaviour that several operations need is shared
as a pure function, not turned into a new type.

- **DDD:** a rich domain model, as opposed to an anaemic one.
- **We differ:** the behaviour is pure and changes nothing. Anything
  that happens to an entity happens in an operation.
- **Status:** locked (L4).

### Value object

A business type defined only by its value. It has no identity, never
changes once it is made and is valid whenever you hold one. It is made
through a constructor that returns a `Result`. In TypeScript it is a
branded type. Value objects are rare.

The test:
1. Does it matter *which one* it is, or only *what it says*? If which
   one, it is an entity.
2. If only what it says, it earns a type of its own when it:
   - could be confused with another value of the same primitive;
   - is made of parts that belong together;
   - has behaviour of its own.

   Otherwise it stays a primitive, or a plain type.

A rule alone does not earn one. The entry point already checks a
single property against the business rules (L12), which is lighter
and just as safe.

Granularity: one value object per whole concept, never one per part.
Money is a value object, and its amount and currency are not.

| Value | Verdict |
|---|---|
| money | a value object: amount and currency belong together, are easily confused, and have arithmetic of their own |
| title | a property: its rule is checked at the entry point (L10) |
| id | a value object once a second kind of id exists |
| completed | a primitive |
| `TodoCounts`, `TodoFilter` | plain types |

- **DDD:** value object.
- **Status:** locked (L8, L10).

### Aggregate

Not used. In DDD an aggregate is a cluster of entities behind one root
that guards their shared rules. In Go terms, given `Todo`,
`type TodoList []Todo` with methods would be one.

We don't need it as a working object, because the operation does its
job. The idea survives as two questions we ask of every operation:
- which rules span several entities?
- what must the store keep atomic?

- **Status:** not used (L5).

## Translation

### Anti-corruption layer (ACL)

A translation inward, from a language that is not ours into business
types. We have three:
- entry-point validation: the request into business inputs. The
  delivery decodes its envelope, and `valid` [decodes](#decode) each
  field and builds the input;
- data's Outer layer: rows or vendor payloads into business objects
  and facts;
- the BFF's api client: the api's wire into the BFF's business types.

- **DDD:** anti-corruption layer.
- **Status:** locked (L9).

### Published language

The shape we promise to others: the contract. Presenting translates
outward, from business into the published language.

- **DDD:** published language.
- **Status:** locked (L9).

### Open host service

A system that serves its published language to whoever calls it. The
api is one: its routes serve the contract.

- **DDD:** open host service.
- **Status:** locked (L9).

### Api spec

The definition of one api, in markdown, at `prd/<app>/api.md`,
written at design time after the use cases. It defines every endpoint
the api serves, probes included, in one form: method and path, input,
reply, error kinds, and the use case or requirement it serves. It also
holds the shapes several endpoints share, and worked examples: each
endpoint's requests and the replies they get. It states every rule as
data, never as a function.

The contract and the OpenAPI document are generated from it. Entry
points and everything below them are written by hand.

- **DDD:** the published language, written down before the code.
- **Status:** target (L26). `prd/todo/api.md` is written, in the
  draft vocabulary (story, chapter 11). The contract and the OpenAPI
  document are generated from it by `tooling/api-spec/generate.ts`.

### Data spec

What each store call must guarantee, in markdown: its input and
result in business types, what it keeps atomic, the order it returns,
and its failures. Nothing is generated from it. Store functions would
cite it, and a conformance suite would test each guarantee.

- **Status:** pending (L26), to be tried after the api spec is built.

### OpenAPI

A document of the api's contract, for backend apis only; the BFF has
none. It is documentation, generated from the api spec beside the
contract, and committed at `apps/api/openapi.json`. No code is
generated from the document itself.

OpenAPI's words map to ours:

| OpenAPI | Ours |
|---|---|
| operation | route: an entry point at a method and path, as Hono records it (`GET /health` reaches a probe) |
| `operationId` | the entry point's name: `postTodos`, `patchTodo`, `getHealth` |
| `x-unit` | the unit the entry point runs: `addTodo`, or a process; a probe has none |

We never call a route an operation. Operation means only a business
use case (L14). `operationId` and `x-unit` come from construct, not the
spec, through the extractor in `tooling/` that also feeds
`apps/api/entry-chains.md`.

- **Status:** target (L23, L26). The document is generated (OpenAPI
  3.1), with the spec's examples; `operationId` and `x-unit` wait for
  the extractor.

## Validation

How a delivery turns what it read into a business input (L27). The
code is `packages/valid`; the story's chapter 7 tells it.

### Delivery

A way the business is delivered: an app that reads input in its own
envelope and shows results in its own way. The api (HTTP and JSON),
the BFF (forms and pages) and, later, a CLI (`argv` and a terminal)
are deliveries. Each has a decoder for its envelope, a message table
and a present module, and they share `valid`, business and
operations.

- **Status:** locked (L27).

### Candidate

What a delivery read for one business input, before it is decoded or
checked: an object with the input's fields, each `unknown`.
`NewTodoCandidate = { title: unknown }`. A delivery fills one in a
line and does no typing work.

- **In the code:** `<Input>Candidate`, beside its function in
  `packages/valid/src/<area>/<input>.ts`.
- **Status:** locked (L27).

### Decode

Narrowing one field's value from `unknown` to the type the field
needs: text, or a boolean from `true`, `false`, `"true"` or `"false"`.
It is the field-level end of the [anti-corruption
layer](#anti-corruption-layer-acl): the envelope is the delivery's to
decode, the fields are `valid`'s. A spelling a delivery needs is added
in `valid`, never in the delivery.

- **In the code:** `packages/valid/src/fields/decode.ts`, private.
- **Status:** locked (L27).

### Check

Applying the business rules to decoded values: trim the title, then
require 1 to `TITLE_MAX` UTF-16 code units, in that order. It is
[Validate once](#validate-once) made one place: every delivery checks
through `valid`, and nothing below the entry point checks again.

- **In the code:** `packages/valid/src/fields/title.ts`, private.
- **Status:** locked (L12, L27).

### Build

Assembling the business input from checked values, and applying the
rules that span fields: a patch must change a title, `completed` or
both (`patch.empty`).

- **In the code:** `to<Input>` in `packages/valid/src/<area>/<input>.ts`:
  `toNewTodo`, `toTodoPatch`, `toTodoFilter`, `toCompleted`.
- **Status:** locked (L27).

### Problem

Why a candidate is not an input: a field, a [rule id](#rule-id) and
all of the rule's parameters, never words. `{ field: "title", rule:
"title.too_long", max: 256 }`. A problem carries every parameter of its
rule, not only the ones the violation touched, so `title.empty` carries
`max` too. `valid` returns every problem it finds; the delivery decides
how many it shows and writes the words, taking any number from the
problem.

- **In the code:** `packages/valid/src/problem.ts`.
- **Not:** a failure (`Fail`). A delivery turns a problem into a
  failure, because the delivery owns the message a failure carries.
- **Status:** locked (L27).

### Rule id

The name of the rule a problem breaks. There are two kinds:
- **decode rules** are generic, named by the type the field needs, with
  the field beside them: `not_text`, `not_boolean`;
- **check rules** are named after the business rule they guard:
  `title.empty`, `title.too_long`, `patch.empty`.

Check rule ids are fixed: use cases cite them, so a check rule is
never renamed.

- **Status:** locked (L27).

## The BFF

### BFF operation

The BFF's own operations: aggregation, filtering and other UI
concerns. The BFF never touches a database and never runs a backend
operation; it reaches the api through its client. `apps/bff` never
lists `@todo/operations`.

- **Status:** locked (L21). The rest waits for the BFF story.

## Open

To be settled in later sessions:
- names for input types (`NewTodo`, `TodoPatch`, `TodoFilter`) and
  read shapes (`TodoCounts`);
- what sits beside entities in `business/entity`: rules, inputs, read
  shapes, `Result`;
- business rules vs validation rules;
- presentation;
- the Supabase access route, and how transaction scopes and intent
  actions keep their atomic promise there: it needs experiments;
- whether D1 stays for the lab, since it cannot offer a transaction
  scope;
- how use cases enter rsb-workflow (parked);
- using another system's business objects: its contract, an ACL in
  data, and our own type for the concept;
- the workflow story: how a durable process runs on Cloudflare
  Workflows;
- the api spec's vocabulary: drafted in the story (chapter 11) and
  used by `prd/todo/api.md` and read by `tooling/api-spec/parse.ts`;
  waiting to be settled;
- `tooling/`, the monorepo's scripts: the extractor that reads
  construct and the generator for `apps/api/entry-chains.md`. The
  generator for the contract and the OpenAPI document is written:
  plain Node scripts with no dependencies, outside the workspace;
- whether the data spec earns its place, once tried.
