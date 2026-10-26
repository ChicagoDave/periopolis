# ADR-0011: The Board is published at periopolis.city from GitHub Pages, one built page, by a workflow that tests first

**Date**: 2026-10-15
**Kind**: product
**Scope**: apps/board, .github/workflows
**Status**: ACCEPTED

## Context

Objective O-2 needs the Board where a practitioner can open it: a public address, over HTTPS, kept current with main. The Board builds to one self-contained page, `apps/board/dist/index.html` (Vite with vite-plugin-singlefile), makes no network calls of its own, and keeps a saved city only in the visitor's browser (`apps/board/src/storage.ts`). The repository, ChicagoDave/periopolis, is public on GitHub. The domain periopolis.city is registered by David, with DNS at GoDaddy. Until now the repository had no CI/CD.

Options weighed (2026-10-15): GitHub Pages, Cloudflare Pages, any other static host. Pages needs no new account and serves a static page with HTTPS; it gives no visit counts, no custom headers and no server-side code. None of those is needed for O-2, which counts written replies, not visits.

## Decision

1. **Host: GitHub Pages, custom domain periopolis.city** (David, 2026-10-15). The apex serves the Board; `www.periopolis.city` redirects to it through Pages.
2. **What is published is the built Board and nothing else.** The site is `index.html` from `apps/board/dist/`. *Amended 2026-10-26 by ADR-0023 Decision 7: one built page, any size — David lifted the size bound for the IRL view, and three.js is bundled into the page. If authored assets ever sit in a folder beside the page, this Decision and the single-file build are amended again.* Documents, sources and tests stay in the repository, reachable through its link, not the site.
3. **Published by `.github/workflows/publish-board.yml`**, on every push to main and on demand. It typechecks, runs every package's tests, builds the Board and runs the Board's browser flows against that build before it deploys; a red step publishes nothing, so the live page is always a build that passed.
4. **The custom domain is a Pages setting, not a file.** A Pages site deployed by a workflow ignores a `CNAME` file, so the domain is set on the repository (Settings → Pages) and HTTPS is enforced there.
5. **The browser flows can be pointed at any address** with `BOARD_URL`; the live site is checked by running them against https://periopolis.city.

## Consequences

- A push to main is a publish. Work that should not be live does not land on main until it should.
- Anything needing a server — a shared gallery of cities, accounts, replies posted from the page — is out of this host's reach; it would be a separate service beside Pages, through the Board's `GameStore` interface for saved cities, and its own decision.
- No visit counts: O-2's measure stays the replies in `docs/objectives/reviews/`.
- The repository stays public; a private repository would need a paid plan for Pages.
- DNS lives at GoDaddy, outside the repository; the records are listed in `docs/work/archive/publish-board-periopolis-city/plan.md` (Phase 1) and must be changed there by hand.

## Session

Session 1afb7b, 2026-10-15; Phase 1 of the O-2 plan (`docs/work/publish-board-periopolis-city/plan.md`).
