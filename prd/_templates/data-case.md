# Data cases: <database>

<!--
One file per database, `prd/<product>/data/<database>.md`; one entry
per store call. An entry says what the call promises and costs, never
how it is written: SQL stays hand-written and is not generated from
this. The budgets tests read the Cost lines; a conformance test holds
one case per Guarantee, run against D1 now and any later store.
Delete these comments when the file is written.
-->

Database: `<binding name>` (`<which D1 database>`)
Tables: `<table>`, `<table>`

## `<area>.<call>`
One line: what the call does, as a fact it reports.

- Port: `<Port>.<method>`
- Used by: `<use case>`, `<use case>`
- Input: in business types or a named read shape (`TodoFilter`)
- Scope: the typed scope the call takes, in store terms (`{ ownerId }`,
  `{ any: true }`), or `none` for a call no actor owns. Not
  `access.md`'s `own | any | n/a`: those say who may call; this says
  what the store is told.
- Result: the fact reported (`inserted | full`, the rows, the change count)
- Guarantee: what it keeps atomic; the isolation it needs; the order it
  returns
- Retry safety: what happens when the call is sent again after an
  unknown outcome (`safe`, or what a second call does)
- Failures: the kinds it can name (`unavailable`, `server`)
- Cost: round trips; rows read and written on the expected path; the
  index it relies on
- Rules: the guarantee rules it satisfies, by id (`todos.order`)
