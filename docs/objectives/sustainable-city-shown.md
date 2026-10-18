# Objective: Show that a sustainable city can be planned, built, populated and powered

**Status**: ACTIVE
**Origin**: conversation — David, 2026-10-14: "I want to show to anyone paying attention to modern city development that a sustainable alternative can be planned, constructed, populated, powered can be achieved. We may not have all of the variables in play yet, but the objective is to close as many of those gaps as possible."
**Date**: 2026-10-14
**Session**: 51a736

Periopolis works a post-car city out from premises (the ledger), lays it out on a site (the Site, the Ground), builds and runs it on a clock (the Run), and shows it beside a car city of the same size (the Board). Every figure carries a mark: Sourced (an outside citation), Yours (David's design choice, with a reason), or Mine (a placeholder nobody stands behind yet). The gaps are the Mine figures and the questions the brainstorm still lists as unknown. This objective answers the brainstorm's open question "What the tool is for outside engineering" (`docs/brainstorm/future-city/overview.md`).

## Outcomes

### O-1: Close the gaps
- **Becomes true**: No figure in the domain docs (`docs/domain/*.md`) or the code (`domain/*/src`) is marked Mine; every figure that was Mine on 2026-10-14 is now Sourced, with a citation anyone can follow, or Yours, with a one-line reason; and each of the brainstorm's "still unknown" items is either modeled or ruled out of scope with a written reason. The tally is reported in three columns: Sourced, Yours, Mine.
- **By when**: 2027-06-30
- **Because**: A reader who follows city development can only trust the comparison if every figure behind it is either cited or owned as a choice; a placeholder is exactly where a skeptic stops reading.
- **Falsified when**: On 2027-06-30 any still-unknown item is neither modeled nor ruled out with a written reason, or any Mine row remains.
- **Baseline**: 51 Mine rows in the domain docs (ledger 16, ground 3, site 17, run 15), 2 Mine premises in the code (`kind: 'mine'`), 5 still-unknown items in `overview.md` (fire and ambulance with no surface vehicles, people who cannot manage the walk to a stop, trips that leave the city, what it costs (largely worked out), a second ring), and 9 "yours to decide" items (captured 2026-10-14)
- **Evidence source**: the repository itself: a count of `| Mine |` rows in `docs/domain/*.md` and `kind: 'mine'` in `domain/*/src`, and the still-unknown list in `overview.md`; each Sourced row's citation is checkable by anyone outside the project. Counted at each session's end.
- **Cadence**: monthly, at the first session of each month, and at every plan's close
- **Grade**: GREEN
- **Status**: ACTIVE

### O-2: Show it to people who build cities
- **Becomes true**: At least 3 people working in city planning or development have reviewed the published Board and replied in writing; their replies are copied into the repository, and any gap a reply names that the model cannot answer is logged as a still-unknown.
- **By when**: 2026-12-31
- **Because**: The objective is to show practitioners, not to convince ourselves; their written reaction is the first evidence that the alternative reads as achievable to someone who builds cities, and the gaps they name set what O-1 closes next.
- **Falsified when**: Fewer than 3 written replies from practitioners arrive by 2026-12-31, or a reply names a gap the model cannot answer and it is never logged as a still-unknown.
- **Baseline**: 0 outside reviewers; the Board is not published anywhere (it builds to `apps/board/dist/index.html`; the repository is github.com/ChicagoDave/periopolis) (captured 2026-10-14)
- **Evidence source**: the reviewers' own written replies (email or comment), copied into `docs/objectives/reviews/` with the reviewer's role and date; produced by the reviewers, independent of the project
- **Cadence**: every two weeks from publishing until 2026-12-31
- **Grade**: GREEN
- **Status**: WITHDRAWN (2026-10-18 — David: no outreach; the project is building the sim as well as it can. The Board stays published at periopolis.city, which Phases 1-2 of `docs/work/archive/publish-board-periopolis-city/plan.md` delivered.)

## Spawned work
- `docs/work/archive/population-from-sourced-rates/plan.md` (populated: who lives here month by month, and one day by hour)
- `docs/work/archive/city-needs-for-new-neighborhood/plan.md` (planned and built: what a new neighborhood needs; a city sized to its people)
