# logbook

The lab record: what was learned building the todo app by hand, for
the `workers-hono-svelte` profile. It is not part of the app, and a
mint never produces it.

```
logbook/
├─ README.md               this file
├─ profile-notes.md        candidate registry entities
├─ findings/NN-<slice>.md  findings about the code, per slice
├─ drafts/                 the draft of each stage, as reviewed
└─ handoffs/               one per stage
```

Drafts and handoffs are named `YYYY-MM-DD-NN-<stage>[-<name>].md`; a
stage's drafts share the number of the handoff it ends with.

**profile-notes entry:** kind (rule | heuristic | check | pattern |
template | note), one-line statement, realized by (path:lines),
machine-checkable (exact | approximate | judgement | no, and how),
slice, status.

**findings entry:** seen (path:lines @ commit), part (1a…7 | test),
finding, outcome (kept | changed (commit) | promoted →
profile-notes#entry | open).
