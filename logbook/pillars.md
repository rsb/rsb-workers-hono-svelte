# Pillars

The owner's four pillars: Reliability, Security, Performance and
Maintainability. They are written down here once and measured.
Nothing in the code is tagged with them, and no build rule comes from
them. Each one has a signal read from outputs the lab already produces.
[pillars-view.md](pillars-view.md) renders the signals at the end of
each stage, and it is read before deciding the next one. Where the
code goes follows the signal, not the name.

**Reliability.** The system fails closed and stays correct when a
dependency fails or two requests race: a store that fails is an
`internal` refusal, never a pass; a config that does not read builds
nothing; errors are values, and none is thrown across a boundary. Its
signal is vitest's JSON report, by level: the tests run and passed in
unit, integration and e2e. Among them are the tests that exercise a
failure mode, such as a failing store in the gate or an unreadable
config.

**Security.** Every threat has a home in the chain and a test that
exercises it. The threats are [threats.md](threats.md). Its signal is
that table's coverage: the rows with a test, of all rows. A row's test
arrives with the slice that builds its mitigation, so the number rises
as the slices land.

**Performance.** Each entry chain has a budget, the cost it spends
written down as data and asserted by a cheap test (L36): store calls
per endpoint, the gate's one identity round trip, the BFF's api calls
per page. Its signal is that the budgets tests pass. A number changes
only in the commit that changes the cost. The numbers are written in
the tests themselves, so the view reads pass or fail, not the numbers.
Moving them into a data file the tests read would let the view print
them, and show how they move from stage to stage.

**Maintainability.** Every spec has an address and a check, so drift
is found, not remembered. Its signal is the generators' and checkers'
reports: `check:api`, `check:access`, `check:rules`,
`check:entry-chains` and `check:join`, each one holding or naming what
drifted.
