# Review tour: stage 22 (the PRD tree), 2026-11-05

Claude wrote this tour of stage 22 for the owner to review. It is a
written tour; nobody led it live. Stage 22 makes the PRD a tree of
documents of known kinds (L44). It adds the feature as the layer
between concept and use cases (L45), and data cases as the data spec
(L46). The first feature is checked against the chain below it. The
five accounts features are written ahead of handoff 23. Nothing under
`apps/` or `packages/` changed.

The branch is `docs/prd-tree`, made from `main` at `ad00d18`:
- `94d726f` `docs(logbook)`: the handoff material as written:
  handoffs 22 and 23, the auth research and explainer, the three
  templates, and `feature-todos-list.md`.
- `366f5fb` `docs(prd)`: the todos feature checked and fixed; `shows:`
  on every Refused row; two template changes the owner approved.
- `dc385bb` `docs(prd)`: the five accounts features.
- `0b2befd` `docs(prd)`: the root thinned; `api.md` gains the kind
  mapping.
- `da774f6` `docs(prd)`: `prd/todo/data/app.md`.
- then the `docs(logbook)` commit: this tour, the story (L44–L46,
  chapter 14), the glossary and handoff 12's row J.

Checks after `da774f6`:
- `pnpm check` exits 0.
- `pnpm check:rules`, `pnpm check:api`, `pnpm check:entry-chains` and
  `pnpm check:join` exit 0.
- `pnpm test:tooling`: 159 pass.
- No generated file changed: `api.md`'s new lines are in its
  preamble, which the generator does not emit, and no rule changed.
- The unit, integration and e2e suites were not run: no code changed.

## 1. The todos feature against its chain

The feature as handed over had three gaps against the seven use
cases, and two errors against the code. All are fixed in the feature,
not the design.

| Found | Fixed as |
| --- | --- |
| `input_error` cited "add-a-todo › refused `title.length`", but `title.length` is an `Assumes:` in both use cases, never a refusal | Produced by `bff (valid › title.length)`, before the api is called. The api's check is the backstop; its refusal is skew and shows `action_failed`. |
| The BFF's "Something went wrong. Try again." on a failed row or control action had no state | `todos.list.action_failed`, not drawn, from any action's `unavailable` or `server` and change-a-todo's `not_found` |
| `not_found` (change, remove) had no state | remove-a-todo's leads to `default` or `empty`, as done; change-a-todo's to `action_failed` |
| `unavailable` sent a failed page load to a state in the view | removed; a failed load renders `accounts.error.failed` |
| Inputs said "an empty edit removes the todo" | an empty edit leaves the todo unchanged, in the BFF (deviation 19; scenario 4.5). The line contradicted the shipped behaviour. |
| Budget said 2 api calls on every load, 1 statement per call | 1 call on `/`, 2 on `/active` and `/completed`; mark all and clear completed are 2 statements. Matches the three budgets tests. |

The board map now lists every file in `design/2026-11-02-ui/`, one row
each; `mobile-light-empty.png` was missing.

**Not yet true in the code.** The BFF renders a failed load inside the
todo view (`load-todos.ts`'s `failedPage`, through `EmptyState`), not
an error view. The feature says `accounts.error.failed`. Slice A
builds the error view; until then this line describes the target.

## 2. `shows:` and the join

Every Refused row in the seven use cases names its state:

```
- `todos.cap` does not hold: `limit`. Nothing is stored.
  shows: `todos.list.full`
```

The rules lint reads every backticked rule id on a Refused line and
fails one that is not under Given. A rule id has exactly two segments
(`ID` in `tooling/rules/parse.ts`) and a state id three, so state ids
are passed over. `check:rules` and `check:join` exit 0 with them, and
nothing in `tooling/` changed.

A risk to note: a data case id, such as `todos.list`, has two segments
and would be read as a rule id if a Refused row ever cited one. None
does. It is also the same text as the feature id `todos.list`; they
are told apart by the file (`data/app.md › todos.list`).

## 3. The accounts features

Five files, each with the design's state wrappers as its state list,
and a board map. The `Produced by` column says what produces each
state, or `open` with the slice that will:

| Feature | Views | Slice A | Open |
| --- | --- | --- | --- |
| shell | `accounts.shell`, `accounts.error` | `signed_out`, `member`, `admin`; `not_found`, `failed` | `signed_out_notice` (B), `forbidden` and `admin_only` (D) |
| sign-in | `accounts.sign_in` | none | all but `default` (B, C for `unverified`) |
| sign-up | `accounts.sign_up` | none | all but `default` (C) |
| profile | `accounts.profile` | none | all; no slice names the name edit, the password change or deletion |
| users | `accounts.users`, `accounts.user_detail` | none | all (D) |

Points for the review:
- **A fourth error state.** The owner agreed three
  (`forbidden`, `not_found`, `failed`). The design's `Error` component
  has four `code` values: `404`, `403`, `403users` and `500`.
  `403users` has its own words ("Users is for admins", and who you
  are signed in as), so by L45 the enum is the state list:
  `accounts.error.admin_only`. Fold it into `forbidden` if the words
  should come from the refusal instead.
- **The chain produces a result no board shows.** authenticate ›
  refused `account_disabled`. It is noted in the shell feature as
  `open` until D, without a state id.
- **The shell's states are not one enum.** `Main` has three props:
  `account` (out, member, admin), `open`, and `notice`. The feature
  lists five states, as agreed: three from the actor, two owned by the
  BFF. Two consequences:
  - `accounts.shell.admin` is drawn only with its menu open;
  - `shell.menu-open.desktop.light` names two files, one per account.
  A board name holds one state, and the design drew one state over
  another.
- **More than two export names differ from their state.** Every one is
  in a board map:
  - `users-searching` → `users.pending`;
  - `verify-email-sent` → `sign-up.sent`;
  - `verify-verified-you-can-sign-in` → `sign-up.verified`;
  - `profile-display-name-error` → `profile.edit-name`, the edit drawn
    with its error;
  - `profile-password-changed` → `profile.password-saved`;
  - `user-detail-disable-reason-required` → `user-detail.reason`;
  - `sign-in-wrong-credentials` → `sign-in.wrong`;
  - `sign-in-check-your-email-unverified` → `sign-in.unverified`;
  - `sign-out-*` → the shell's.
- **One state is not drawn.** `accounts.sign_up.resent` is in
  `SignUp`'s enum, with no board.
- **The map was checked by a script.** Every PNG in both exports maps
  to exactly one row (13 and 58), and every board name parses back to
  its state. The script was run once and is not kept.

## 4. The root

`prd/todo.md` keeps the sections the handoff names. What moved:

| From | To |
| --- | --- |
| Design › Theme, Tokens, Type, Wording, Completion, Motion, Focus, and "this file wins" | Constraints › C-design, as sub-items |
| Design › Screens | the feature's views and board map |
| API › the table and "rules that apply to every route" | `api.md`, which had every endpoint, query rule and limit already. Two lines were missing and are added to its preamble: a body that is not JSON is `validation` with field `body`; a use case's `unavailable` and `server` reach the wire as `internal`. |
| Acceptance scenarios 2 to 8 | the feature's Done, byte for byte, numbers kept |
| Done's "acceptance scenarios above" | scenario 1, plus every feature's Done |

Design, API and Acceptance scenarios stay as headings with one
pointer paragraph. Two code comments cite "(PRD, Design)"
(`apps/bff/src/app.css`, `apps/bff/src/routes/+layout.svelte`), and
`rules.md` cites "PRD › API" as `todo.exists`'s source. With the
pointers, all three still resolve without touching code or a
generated file. The e2e files cite "PRD scenarios 2.1–2.8" and the
like; the numbers hold.

The amendment records the move and says "Sign-in and users" leaves
Out of scope in slice A's amendment, not this one.

## 5. Data cases

`prd/todo/data/app.md` has seven entries, one per `DbStore` method.
Ids are `todos.<call>`. Cost lines are the data budgets test's
numbers, plus the rows each reads and writes and the index it uses.
Two guarantee lines differ from what one might assume:
- `todos.add_unless_full` is not safe to retry. Each add gets a fresh
  id (D13), so an add sent again after an unknown outcome can store a
  second todo.
- `todos.delete` retried reports absent, which the BFF treats as done.

## 6. Template proposals (not applied)

Applied, as the owner approved: the Board value `not drawn`, and the
`## Board map` section.

Proposed for `prd/_templates/feature.md`:
1. Say how a board name is spelled from a state id: underscores become
   hyphens (`input_error` → `list.input-error`). Both exports and the
   todos feature already do this; the template does not say it.
2. Name the forms `Produced by` takes: a use case's result or refused
   kind, `bff`, a gate (the shell's states come from authenticate,
   which is not a use case), or `open: <slice> (…)`.
3. Done: say what a feature written ahead of its slice writes ("None
   yet. Slice B writes the scenarios.").
4. A Data cases column in Actions, as Reads has.

Proposed for `prd/_templates/data-case.md`:
5. A Scope field, for slice A, when every call takes the actor's
   scope (L43).
6. Retry safety as a field of its own, not inside Guarantee: it was
   the line most worth reading in `app.md`.

Proposed for `design/_templates/design-brief.md`:
7. Spell multi-word states one way in the enum. The accounts export
   used camelCase (`fieldErrors`), while the feature uses
   `field_errors` and the board `field-errors`.
8. Say how a frame with independent props is drawn: one component per
   view with one `state` enum, and a BFF state drawn over a chain
   state named once (see section 3).

## 7. For handoff 23

- `signed_out` in slice A is written into the shell feature as the
  owner said: anonymous, `GET /todos` refused by the runner, no list,
  no redirect. Handoff 23 should say what "Sign in" and "Create an
  account" do before B and C give them pages.
- The shell's Reads row names the actor read as "slice A names it":
  item 6 of the handoff says one call per page load, but no endpoint.
- `accounts.error.not_found` and `.failed` are marked slice A. The
  handoff names only the signed-in shell. Confirm, or move them.
- The todos feature's failed load becomes `accounts.error.failed`
  (section 1).
- What the admin shell's "Users" link does before D.

## 8. Story delta

- The api story records L44–L46 after L36. It notes that L37–L43
  belong to handoff 23 and are recorded when stage 23 builds them.
- Chapter 8: "Pending (L26)" becomes the data cases (L46). The
  budgets paragraph says the Cost lines and the data table are edited
  together until the table reads them.
- Chapter 11: the spec levels table loses "view" and gains "feature":
  addresses and no check, so not a spec level.
- Chapter 14, new: "From idea to code": the six layers, the tree,
  feature, view, state and board, `shows:`, open states, data cases.
- Glossary:
  - new: PRD, Feature, View, State and Board, in a new section "The
    PRD tree", and Data case;
  - Data spec is now locked;
  - Process amended: its first is sign-up (slice C), and "the process
    from idea to code" is not this word. Claude's reading of "amend
    process" in the handoff;
  - "whether the data spec earns its place" leaves Open.
- Handoff 12's row J is done, stage 22.
- The BFF story is not touched. Its view chapter can cite the
  feature's states when the BFF next changes.
