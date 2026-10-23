/**
 * @file The needs card: what the city lacks to keep its lines whole, where each addition would go and what it costs,
 * with Show (mark its tiles), Add (build it) and Add all (ADR-0008). The Site proposes; the card only words and asks.
 * Public interface: drawNeeds.
 * Owner context: Board (adapter).
 */
import { RATES, proposeFor } from '@city/site';
import type { Proposal, Step, TileKey } from '@city/site';
import { button, byId, el } from '../dom.ts';
import { accept } from '../moves.ts';
import type { Page } from '../page.ts';
import { needText, needsNow, proposalPrice } from '../wording.ts';

/** The tiles a proposal's steps touch, once each. */
function tilesOf(steps: readonly Step[]): TileKey[] {
  const out: TileKey[] = [];
  for (const st of steps) for (const k of st.command === 'layStretch' ? [st.from, st.to] : [st.tile]) if (!out.includes(k)) out.push(k);
  return out;
}

/**
 * Draw the needs card from the session's game.
 * @param page - the page
 */
export function drawNeeds(page: Page): void {
  const { s } = page;
  const running = Boolean(s.game.clock);
  const proposals: readonly Proposal[] = running ? [] : proposeFor(s.game.layout, RATES);
  const buildable = proposals.filter((p) => p.room);
  const noRoom = proposals.some((p) => !p.room);
  byId('needsnow').textContent = needsNow(buildable.length, running, noRoom);
  const all = byId<HTMLButtonElement>('addall');
  all.hidden = buildable.length < 2;
  all.onclick = () => page.commit(accept(s.game, proposals));
  const list = byId('needlist');
  list.textContent = '';
  proposals.forEach((p, i) => {
    const li = el('li', p.room ? 'need' : 'need noroom');
    li.append(el('span', 'what', needText(p.need, s.game.layout, RATES)), el('span', 'price', proposalPrice(p)));
    if (p.room) {
      const tiles = tilesOf(p.steps);
      const acts = el('span', 'acts');
      acts.append(
        button('Show', () => page.highlight(tiles)),
        // A stretch to a plant or ring proposed earlier builds that first, so the line never runs to open ground.
        button('Add', () => page.commit(accept(s.game, proposals.slice(0, i + 1).filter((x, j) => j === i || needsBefore(x, p))))),
      );
      li.dataset.tiles = tiles.join(' ');
      li.append(acts);
    }
    list.append(li);
  });
}

/** Whether an earlier proposal must be built first: it starts the ring or plant a later stretch runs to. */
function needsBefore(earlier: Proposal, later: Proposal): boolean {
  if (!earlier.room || !later.room) return false;
  const made = new Set<TileKey>();
  for (const st of earlier.steps) if (st.command === 'addRingBuilding' || st.command === 'addPlantUnit') made.add(st.tile);
  return later.steps.some((st) => st.command === 'layStretch' && (made.has(st.from) || made.has(st.to)));
}
