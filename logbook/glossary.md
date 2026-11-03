# Glossary

The words we use to talk about apps on this stack. Each term says what
it means here, how it relates to Domain-Driven Design, where it lives
in the code and whether it is settled.

We ground our language in DDD's concepts but not in its usual code.
DDD examples are object-oriented: repositories, services and
aggregates that guard their own state. Our code is functions and
types arranged in a chain, so where a DDD term would bring an OO shape
with it, we keep the idea and say how we realize it.

Decisions L1–L10 were agreed in the language session of 2026-11-03.
They are recorded in [the api story](the-api-story.md).

Status:
- **locked:** agreed, and the story follows it;
- **target:** agreed, and the code does not follow it yet;
- **not used:** a DDD term we deliberately do without;
- **open:** still under discussion.

## The chain

### Chain

The path every request takes:
startup → entry point → operation (using business) → port ← data.
Construct does the wiring. Each link has one role, and a request
cannot skip a link.

- **DDD:** layered architecture, with the domain at the centre.
- **We differ:** the boundary is kept by the architecture (checked
  imports and tests), not by encapsulation. Each link can be tested on
  its own, with or without a mock, and in every test category.
- **Status:** locked (L2).

### Boundary

The line between two links of the chain. What may cross it, and in
which direction, is fixed by `package.json` dependencies and checked
by tests.

- **DDD:** the line between layers. It is not a bounded context,
  which is a whole system with its own language.
- **Status:** locked (L2).

### Seam

The point where one link calls the next. Both of our seams are shaped
by the caller:
- an entry point calls an operation with business inputs;
- an operation calls a port declared for what it needs.

Ports are coupled to business types on purpose. Because the seams
matter this much, we build in vertical slices, so each seam is made
for the work that uses it.

- **Status:** locked (L6).

### Entry point

A handler. It turns loose input into well-defined business inputs,
runs one operation, handles its failures and presents its result.
See [the api story](the-api-story.md), chapter 5.

- **DDD:** application layer, inbound adapter.
- **Status:** locked.

### Operation

The only place anything happens to an entity. It takes business
inputs, enforces the business rules, uses its ports and produces one
outcome: an entity, several entities, a mix of the two, or a failure.
A different outcome is a new operation, which may reuse the same
entity behaviour.

Lives in `packages/operations`, one file per operation with its port.

- **DDD:** application service, and also the job of the aggregate
  (guarding a rule across several entities).
- **We differ:** it is a function, not a service object, and it holds
  no state.
- **Status:** locked (L1, L4, L5).

### Port

The interface an operation declares for what it needs from the world.
It is owned by the operation, named for intent
(`addTodoUnlessFull(todo, limit)`), speaks business types and returns
a `Result`.

- **DDD:** repository.
- **We differ:** no repository per entity and no generic CRUD. Each
  operation declares the smallest port it needs, and one flat store
  satisfies them all.
- **Status:** locked.

### Data

The concrete world, one package per real thing. It satisfies ports,
maps business objects to its own representation and back, and reports
facts. It makes no ids and decides no rules.

- **DDD:** infrastructure, repository implementation.
- **Status:** locked.

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

To apply a rule to a real case and decide the outcome. Only operations
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
is kept.

- **DDD:** the aggregate's consistency boundary.
- **Status:** locked (L1, L7).

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

- **DDD:** entity.
- **We differ:** a type plus functions beside it, not a class.
- **Status:** locked (L3). Its package, `business/entity`, is a
  target.

### Entity behaviour

Pure business logic about an entity, which lives beside it.
`newTodo(id, input)` is entity behaviour: a new todo is not completed.
Operations compose entity behaviour with their ports to produce their
outcome. Behaviour that several operations need is shared as a pure
function, not turned into a new type.

- **DDD:** a rich domain model, as opposed to an anaemic one.
- **We differ:** the behaviour is pure and changes nothing. Anything
  that happens to an entity happens in an operation.
- **Status:** locked (L4).

### Value object

A business type defined only by its value. It has no identity, never
changes once it is made and is valid whenever you hold one. It is made
through a constructor that returns a `Result`. In TypeScript it is a
branded type.

The test:
1. Does it matter *which one* it is, or only *what it says*? If which
   one, it is an entity.
2. If only what it says, it earns a type of its own when it:
   - has a rule;
   - could be confused with another value;
   - is made of parts that belong together;
   - has behaviour of its own.

   Otherwise it stays a primitive.

| Value | Verdict |
|---|---|
| title | a value object: it has a rule |
| id | a value object once a second kind of id exists |
| completed | a primitive |
| `TodoCounts`, `TodoFilter` | plain types |

- **DDD:** value object.
- **Status:** locked (L8). `Title` is the first value object (L10). It
  is a target, and where its rule is applied is open (validation).

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
- entry-point validation: the request into business inputs;
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

## Open

To be settled in later sessions:
- the owner's second caution about DDD;
- names for input types (`NewTodo`, `TodoPatch`, `TodoFilter`) and
  read shapes (`TodoCounts`);
- what sits beside entities in `business/entity`: rules, inputs, read
  shapes, `Result`;
- business rules vs validation rules;
- presentation;
- the Supabase access route.
