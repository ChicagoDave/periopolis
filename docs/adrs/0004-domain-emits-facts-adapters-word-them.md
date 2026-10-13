# ADR-0004: Domain packages emit typed facts and events; adapters word them

**Date**: 2026-10-12
**Kind**: technical
**Status**: ACCEPTED

## Context

The sketch's engine returns English: each line check carries a title and a detail sentence, each marked tile a list of sentences, and each move a sentence about what happened. The page shows them as they are. Porting that into `domain/site` would put prose in the domain, where it cannot be typed, cannot be reworded without touching the rules, and ties the rules to one language and one front end. The plan's convention already says the sentences the page shows are the Board's translation of events; Phase 2 had to decide how far that reaches, because the checks' sentences carry numbers the rules compute.

## Decision

1. A domain package never writes a sentence. Commands answer with typed events or typed rejections; checks return a status, the tiles they mark, and typed facts, one shape per check and case; tile issues are a typed union. Numbers travel as numbers.
2. Adapters word them. The Board holds the wording of every event, rejection, check case and issue, in one place, and nothing else in the Board builds a sentence from rule state.
3. The sketch's sentences stay the parity oracle for the wording. The Site's fixture recorder keeps the sketch's titles, details, issues and move sentences beside the structures; the Board's wording tests in Phase 4 assert them exactly.
4. The Run context follows the same rule for its notices and its record in Phase 3: events and typed facts out, wording in the Board.

## Consequences

- A check's facts are a contract. Adding a case means adding a fact shape and its wording in the same change, and the type checker reports a case the Board has not worded.
- Rewording, translating, or shortening a sentence touches the Board only, and the parity suite for the domain does not move.
- The sketch's sentence parity is not proven until Phase 4. Phase 2's parity suite compares statuses, tiles, figures and the count of issues per tile, which is what the domain owns.
- A second front end words the same facts its own way without a second copy of the rules.
- The stretch tests' labels and the plants' and schools' display names are wording too, and live in the Board.

## Session

Session 0b9b51, 2026-10-12, Phase 2 of `docs/work/port-city-builder/plan.md`.
