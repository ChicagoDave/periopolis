# ADR-0003: The port is at parity with the sketch, and designs nothing new

**Date**: 2026-10-12
**Kind**: process
**Status**: ACCEPTED

## Context

The prototype worked. Its figures had been argued over for five days and its car column, built only from its own premises, had been compared with US data and never tuned. A port that also redesigned would have no way to tell a deliberate change from a slip, and the whole point of the car column, that it vouches for the other, would be lost. The prototype's sources and check scripts were copied into `docs/work/port-city-builder/sketch/` on 2026-10-11 for exactly this reason.

## Decision

1. Behavior is frozen at the page published on 2026-10-11. The port changes language, structure and types; it does not change a figure, a rule or a sentence's meaning.
2. The sketch is the oracle. For each context, fixtures are recorded from the sketch's own code by a script kept beside the tests, and a parity test compares every figure the port derives against the record. The check scripts' printed results are the oracle where no fixture is recorded.
3. A phase of the port is not complete until its parity suite reports no difference. A difference is a defect in the port until shown to be a defect in the sketch; a defect in the sketch is fixed in both, recorded, and the fixture refreshed.
4. Anything new (the physical city, a non-hexagon site, money, the ledger's own page) is its own plan after the port, and starts from the ported code. *The physical city landed as ADR-0005 and the non-hexagon site as ADR-0006 (2026-10-13), which pins the parity oracle to the sketch's own outline.*

## Consequences

- Each domain package carries `test/fixtures/` and a `record-fixtures` script that reads the sketch. When the plan is archived, the script's path to the sketch moves with it (`docs/work/archive/port-city-builder/sketch/`).
- The sketch is read-only. It is archived with its plan and never extended.
- Review of a port phase asks one question first: does the parity suite pass. Design review of the sketch's choices is out of scope until the port ends.
- Where the port's types force a choice the sketch did not make (for example, the two ledger columns as two types rather than one object with flags), the choice must leave every figure unchanged, and the parity suite is what proves it.

## Session

Session 0b9b51, 2026-10-12, Phase 1 of `docs/work/port-city-builder/plan.md`.
