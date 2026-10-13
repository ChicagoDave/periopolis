# ADR-0005: The Ground is its own context over the Ledger, beside the Site

**Date**: 2026-10-13
**Kind**: technical
**Status**: ACCEPTED

## Context

The physical city (`docs/work/physical-city/plan.md`) draws what one tile holds: rows of townhouses, the center, the park, the lane, and underneath the entries, the walkway, the pipe and the stop. The Ledger already fixes nearly every figure, as counts, lengths and areas per city. Somewhere has to turn those into shapes in metres. Three homes were possible: the Site, which already owns the tile and its coordinates; the Board, which already draws; or a new context. ADR-0001 Decision 3 enumerates the import chain as Board → Run → Site → Ledger and does not name a fourth domain package.

## Decision

1. The geometry of a tile's ground is a new bounded context, **Ground**, in `domain/ground` (`@city/ground`), pure and deterministic like the others.
2. Ground depends on `@city/ledger` alone. It does not import the Site: the Site answers whether the lines hold on a layout; the Ground answers what a tile looks like. Neither needs the other's rules, and the Site's parity suite (ADR-0003) must not move when a drawing choice changes.
3. The Board may import Ground, as it may import Site. ADR-0001 Decision 3's chain is amended to read: Board → Run → Site → Ledger, and Board → Ground → Ledger.
4. Ground returns typed shapes and figures, never sentences (ADR-0004). Every sum the Ledger fixes is reconciled by a guard inside `planNeighborhood`; every placement the Ledger leaves open is named in the plan's `placeholders` list, so the Board can mark it the way the brainstorm marks "Mine".
5. Ground's output is projection-neutral: shapes in plan view in metres plus story counts. Whether the Board shows a plan view or an angled view is the Board's choice and the user's open question; choosing angled adds a projection in the Board, not a second Ground.

## Consequences

- A fourth domain package, with its own tests and `docs/domain/ground.md`. The import-direction check gains one line: Ground imports nothing but the Ledger.
- Changing a placement (the row pitch, where the park sits) touches Ground and its tests only; the Ledger's and the Site's suites do not move.
- A figure Ground needs that the Ledger does not derive is added to the Ledger first, as a consequence, not computed in Ground from premises the Ledger also reads.
- When the Site's outline changes (item 2 of the brainstorm's "Next": a site that is not a hexagon of hexagons), the frame Ground draws into is the thing to revisit; the plan's sums are frame-independent.

## Session

Session b5271b, 2026-10-13, Phase 1 of `docs/work/physical-city/plan.md`.
