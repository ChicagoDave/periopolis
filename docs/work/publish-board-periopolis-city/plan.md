# Session Plan: Objective O-2 — publish the Board at periopolis.city

**Created**: 2026-10-15
**Plan Status**: ACTIVE
**Overall scope**: Put the built Board (`apps/board/dist/index.html`) on the public web at periopolis.city, give a stranger what they need to review it, get at least 3 written replies from people who work in city planning or development into `docs/objectives/reviews/`, and log every gap a reply names that the model cannot answer as a still-unknown, all by 2026-12-31.
**Bounded contexts touched**: Board (adapter, wording only; no rule changes). Otherwise N/A — publishing, deployment and outreach work, framed in plain technical terms (no DDD decomposition).
**Key domain language**: Board, still-unknown (the list in `docs/brainstorm/future-city/overview.md`), Sourced / Yours / Mine, review (a practitioner's written reply)

## Objective being served

`docs/objectives/sustainable-city-shown.md`, O-2 "Show it to people who build cities":
- Becomes true: at least 3 people working in city planning or development have reviewed the published Board and replied in writing; replies are copied into the repository; any gap a reply names that the model cannot answer is logged as a still-unknown.
- By when: 2026-12-31. Cadence: every two weeks from publishing.
- Falsified when: fewer than 3 written replies by 2026-12-31, or a named unanswerable gap is never logged as a still-unknown.
- Baseline: 0 outside reviewers; the Board is not published (captured 2026-10-14).
- Evidence source: reviewers' own written replies, copied into `docs/objectives/reviews/` with reviewer role and date.
- Measurement plan: count of files in `docs/objectives/reviews/` from practitioners (role recorded) at each fortnightly check; each named gap traced to a still-unknown entry.

## References consulted
- `docs/objectives/sustainable-city-shown.md` — O-2 outcome, deadline 2026-12-31, fortnightly cadence, evidence location `docs/objectives/reviews/`, and the falsifier on unlogged gaps.
- `docs/context/project-profile.md` — Board builds with Vite plus vite-plugin-singlefile to one `apps/board/dist/index.html`; no CI/CD exists; pnpm 10.28.2, Node >=22; Playwright flows are not part of `pnpm -r test`.
- `docs/context/session-20261014-2307-main.md` — newest session; population plan closed and archived, nothing blocking, no open item concerning publishing.
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — adapters live under `apps/*`; the Board holds no rules, so publishing changes touch `apps/board` and repo config only, never `domain/*`.
- `docs/adrs/0002-no-regular-expressions.md` — no regular expressions in any script or test written here (deploy scripts, URL checks included).
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — any reviewer-facing sentences are Board wording, not domain output.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` (Scope: apps/board intersects) — Board changes must leave the starter layout, existing commands and parity untouched.
- `docs/adrs/0009-population-is-occupancy-moved-month-by-month.md` (Scope: apps/board intersects) — the published Board shows the month clock and day view; the published figures (e.g. 3.37 trips a day, ADR-0010) must not change as a side effect of publishing.
- Product ADRs not consulted (no Scope intersection): none (the repo has no product ADRs)
- Proposals: none present (`docs/proposals/` does not exist).

## Phases

### Phase 1: Publish the Board at periopolis.city
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: N/A — deployment. Board adapter output only.
- **Entry state**: `pnpm -r test` and `pnpm -r typecheck` green; `apps/board` builds to one self-contained `dist/index.html`. David owns the periopolis.city registration and can set DNS (Decision needed from David: the host; default proposal is GitHub Pages from the public repo ChicagoDave/periopolis with a `CNAME`, since the repo is already on GitHub and the page is one static file).
- **Deliverable**: A product-kind ADR (Kind: product, Scope: apps/board) recording where and how the Board is published and what is deliberately not published; a repeatable publish path (a GitHub Actions workflow or a documented script, no regular expressions per ADR-0002) that runs the tests, builds, and deploys `dist/index.html`; custom-domain config and DNS records documented; HTTPS on.
- **Exit state**: https://periopolis.city serves the current Board over HTTPS; a push to main (or the documented command) republishes it; the publish path is in the repo and the ADR names the host.
- **Demonstration**: Fetch https://periopolis.city and check the response is 200 over HTTPS and contains the Board page (a fixed string from `apps/board/index.html`); run the Playwright flows (`pnpm --filter @city/board test:e2e` pointed at the live URL, or the key flow: line checks show 14 of 15 on the starter) against the live site; it must show the same figures as the local build.
- **Publish path** (ADR-0011): `.github/workflows/publish-board.yml` on push to main or run by hand; the browser flows take `BOARD_URL` to run against the live site.
- **Pages setup** (by hand; the gh token cannot reach the Pages API): Settings → Pages → Source "GitHub Actions"; Custom domain `periopolis.city`; Enforce HTTPS once the certificate is issued.
- **DNS at GoDaddy** (replaces the parking A records 3.33.130.190 and 15.197.148.33):
  - `@` A: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
  - `@` AAAA: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
  - `www` CNAME: chicagodave.github.io
- **Demonstrated**: 2026-10-15 — workflow run 38687545953 (push of b76820d) green and deployed; https://periopolis.city answers HTTP/2 200 from GitHub.com, and the served page has the same sha1 (55f3b04b) as a local build of apps/board; `BOARD_URL=https://periopolis.city pnpm exec playwright test` in apps/board: 9 passed, including the starter's 14 of 15 lines holding; http://www.periopolis.city answers 301 to the apex. Enforce HTTPS waits on David ticking it in Settings → Pages.
- **Status**: DONE

### Phase 2: A stranger's front door on the Board
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Board wording and page furniture; no rule or figure changes (ADR-0004, ADR-0008, ADR-0009).
- **Entry state**: Phase 1 done (or in parallel with it: this phase is independent of hosting and only needs a built Board; it must merge before outreach in Phase 3).
- **Deliverable**: On the Board, a short "What this is and how to review it" panel for a practitioner arriving cold: what Periopolis claims, the Sourced / Yours / Mine convention, where the source lives (github.com/ChicagoDave/periopolis), and how to reply (an email address or issue link David confirms). Board tests for the new wording; the e2e flows still green.
- **Exit state**: A first-time visitor can tell in one screen what is being shown, that every figure carries a mark, and exactly where to send a written reply; published at periopolis.city via Phase 1's path.
- **Demonstration**: Load the live site in a clean browser profile (Playwright, no stored game) and assert the panel text and the reply address are on screen; wording tests and `pnpm -r test` green.
- **Demonstrated**: 2026-10-15 — workflow run 38689746411 (push of 32aa977) green and deployed; `BOARD_URL=https://periopolis.city pnpm exec playwright test` in apps/board: 10 passed, each in a fresh browser context, including the front-door flow (panel heading and claim, the Sourced / Yours / Mine chips, the source link, and the review link to `issues/new?template=review.yml` in the first screen); `pnpm -r test` 538 passed. Replies go to a GitHub issue through the form `.github/ISSUE_TEMPLATE/review.yml`, which applies the `question` label (a label in the link is ignored for non-collaborators); a reviewer's city comes back through the Board's existing "Copy the city as text", so no share link was built. [reported by session, unverified: no event-log row for the live run]
- **Status**: DONE

### Phase 3: Reviewer intake and first outreach
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: N/A — evidence handling and outreach. Evidence directory `docs/objectives/reviews/`.
- **Entry state**: Phases 1 and 2 done; David supplies the names or channels of practitioners to approach (aim for at least 8 to land 3 written replies; the falsifier counts replies, not invitations).
- **Deliverable**: `docs/objectives/reviews/README.md` (file naming `YYYY-MM-DD-<reviewer-slug>.md`, required header: reviewer role, date, how received, verbatim reply, gaps named); an outreach message draft David sends; `docs/objectives/reviews/outreach.md` listing who was asked, role and date (no private contact details committed without consent); the rule written down for a named gap: add it to the still-unknown list in `docs/brainstorm/future-city/overview.md` with the review file cited.
- **Exit state**: The intake format exists and is committed; the first outreach wave is sent (David's action, recorded by date and count); the clock for the fortnightly cadence starts at the publish date.
- **Demonstration**: `ls docs/objectives/reviews/` shows the README and outreach record; the outreach record shows at least 8 invitations sent with dates; the live Board link in the message opens the site.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 4: Fortnightly review checks (recurring through 2026-12-31)
- **Tier**: Small
- **Budget**: ~100 tool calls per check, one session per fortnight (about 2026-11-05, 2026-11-19, 2026-12-03, 2026-12-17)
- **Domain focus**: N/A — evidence and measurement. Touches `docs/objectives/reviews/` and the still-unknown list in `docs/brainstorm/future-city/overview.md`.
- **Entry state**: Phase 3 done and replies may have arrived. This phase is run once per fortnight; it stays CURRENT until the last check unless the objective is met earlier and a close-out is chosen.
- **Deliverable**: Each check: copy any new written reply, verbatim, into `docs/objectives/reviews/` with reviewer role and date; for each gap a reply names that the model cannot answer, add a still-unknown to `overview.md` citing the review file; report the count to date against 3 and the invitations outstanding; send a second wave if the count trails the calendar (fewer than 1 reply by mid-November, fewer than 2 by early December).
- **Exit state**: Every received reply is in the repository and every unanswerable gap in them is logged as a still-unknown; the count and date of the check are stated in the session summary.
- **Demonstration**: Count the review files with a recorded practitioner role (`ls docs/objectives/reviews/`) and show each named gap resolving to an entry in `overview.md` by its cited file name.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 5: O-2 close-out at 2026-12-31
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: N/A — objective measurement.
- **Entry state**: 2026-12-31 reached or at least 3 practitioner replies already logged; Phase 4 checks are up to date.
- **Deliverable**: A measurement entry for O-2 in `docs/objectives/sustainable-city-shown.md` (count of practitioner replies, count of gaps named, count logged as still-unknown) with the grade GREEN or its falsification stated plainly; the list of new still-unknowns handed to O-1 as inputs; if falsified, the cause and the next step written down rather than the date moved.
- **Exit state**: O-2's status is set from evidence (the count against the falsifier), the new still-unknowns appear in O-1's baseline notes, and this plan is closed and archived.
- **Demonstration**: Run the count of review files against 3 and trace each named gap to its still-unknown entry; the output must reproduce the figures written into the objective.
- **Demonstrated**: 
- **Status**: PENDING
