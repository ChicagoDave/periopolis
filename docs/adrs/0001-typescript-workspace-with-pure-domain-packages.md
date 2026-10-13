# ADR-0001: A TypeScript workspace with pure domain packages and inward dependencies

**Date**: 2026-10-12
**Kind**: technical
**Status**: ACCEPTED

## Context

The prototype is one published page of plain browser JavaScript with no build step. Its rules are already pure functions with no drawing in them, and they are the durable part: the ledger's arithmetic, the site's line checks, the clock's events. The port needs a home where those rules are proven by tests, where the page cannot reach into them, and where a different front end could replace the page later without touching them. The conversation of 8 to 12 October 2026 settled on the web (`docs/brainstorm/future-city/techstack.md`); what remained open was the shape of the repository and the versions to pin.

## Decision

1. One pnpm workspace, TypeScript in strict mode, ES modules. Packages under `domain/*` are bounded contexts; packages under `apps/*` are adapters. The scope is `@city/*`.
2. Domain packages are pure and deterministic: no DOM, no storage, no wall clock, no random source that is not seeded. They compile with `lib: ["ES2022"]` and `types: []`, so a DOM or Node import fails the type check.
3. Dependencies point inward only: Board → Run → Site → Ledger. The Board may also import Site. Each context exports one intentional interface from its `index.ts`; nothing else in the package is public.
4. Vitest runs the tests; each package owns its `test` and `typecheck` scripts, and the root runs them recursively.
5. Versions are pinned from the registry as it stood on 2026-10-12: TypeScript 7.0.2, Vitest 5.0.4, pnpm 10.28.2. Vitest 5 declares Node 22, 24 or 26 and newer; it runs on the Node 25 this was built with, which is noted rather than relied on.

## Consequences

- A new context is a new package under `domain/` with its own tests; a new front end is a new package under `apps/`. Neither changes the other side.
- Anything that needs a browser or a clock belongs in an adapter. A domain package that wants one has the wrong boundary.
- The import direction is checkable: a domain package importing a sibling it should not, or an app, fails review. Ledger imports nothing outside itself.
- Base compiler options live in `tsconfig.base.json`; each package extends it and may only add, never loosen.
- Leaving the web (a full simulation, a store product, an iPad-first app) replaces `apps/`, not `domain/`.

## Session

Session 0b9b51, 2026-10-12, Phase 1 of `docs/work/port-city-builder/plan.md`.
