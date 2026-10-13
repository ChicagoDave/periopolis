# ADR-0002: No regular expressions in code

**Date**: 2026-10-12
**Kind**: technical
**Status**: ACCEPTED

## Context

The site and the run key their state by structured text: a tile is `"q,r"`, a stretch of mover line is `"q,r|q,r"`, and the record names lines and years. The prototype parsed these by walking the string. The temptation in a port is to reach for a regular expression, which is terse, hard to read back, easy to get subtly wrong at the edges (negative coordinates, missing parts), and opaque to the type checker.

## Decision

No regular expressions anywhere in this repository's code, including tests and scripts. Keys and text are parsed by walking their structure: split on the known separator, read each part, reject what does not fit. Where the structure is rich enough to deserve it, write a small parser with a name.

## Consequences

- Every key format has a parse function and a format function beside each other, and the parse function names what it rejects. Those are the tests' entry points.
- Code that validates text does so with explicit checks, which cost more lines and read as rules rather than patterns.
- A reviewer can search for the construct and treat any hit as a defect, which is the point: the rule is mechanical.
- Third-party code under `node_modules` is not the repository's code and is not governed.

## Session

Session 0b9b51, 2026-10-12, Phase 1 of `docs/work/port-city-builder/plan.md`.
