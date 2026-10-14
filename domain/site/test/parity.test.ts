/**
 * @file Parity: every figure and status the port derives matches the sketch's engine, recorded in fixtures/parity.json.
 * The sketch's sentences are in the record for the Board's wording tests; here they are compared only by count.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  RATES,
  addPlantUnit,
  allTiles,
  hexagon,
  addRingBuilding,
  assess,
  bridges,
  closable,
  erase,
  isPlantKind,
  layStretch,
  placeNeighborhood,
  restoreLayout,
  seat,
  toggleExtra,
} from '../src/index.ts';
import type { EdgeKey, ExtraKind, Layout, Outcome, Stress, TestId, TileKey } from '../src/index.ts';
import recorded from './fixtures/parity.json';

type Json = number | string | null | boolean | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

interface Evaluation {
  readonly name: string;
  readonly state: Layout;
  readonly showing: TestId | null;
  readonly now: Stress | null;
  readonly result: Obj;
}

interface Act {
  readonly tool: string;
  readonly key: TileKey;
  readonly from: TileKey | null;
  readonly before: Layout;
  readonly after: Layout;
  readonly said: string;
  readonly changed: boolean;
}

interface SeatingCase {
  readonly name: string;
  readonly takers: { key: string; amount: number }[];
  readonly places: { key: string; cap: number }[];
  readonly limit: number;
  readonly minutes: Record<string, Record<string, number>>;
  readonly result: Obj;
}

interface Fixture {
  readonly rates: Obj;
  readonly evaluations: Evaluation[];
  readonly acts: Act[];
  readonly seatingCases: SeatingCase[];
  readonly cleanCases: { name: string; raw: unknown; result: Json }[];
  readonly bridgeCases: { name: string; state: Layout; result: Json; closable: EdgeKey[] }[];
}

const fixture = recorded as unknown as Fixture;

function thaw(v: Json): Json {
  if (v === 'Infinity') return Infinity;
  if (v === '-Infinity') return -Infinity;
  return v;
}

/** Compare a value against the record, naming the path of any difference. */
function differences(actual: unknown, want: Json, path: string, out: string[]): void {
  const w = thaw(want);
  if (typeof w === 'number') {
    if (typeof actual !== 'number') out.push(`${path}: expected ${w}, got ${String(actual)}`);
    else if (w !== actual && !(Math.abs(actual - w) <= Math.abs(w) * 1e-9 + 1e-12)) out.push(`${path}: expected ${w}, got ${actual}`);
    return;
  }
  if (w === null || typeof w !== 'object') {
    if (actual !== w) out.push(`${path}: expected ${String(w)}, got ${String(actual)}`);
    return;
  }
  if (Array.isArray(w)) {
    if (!Array.isArray(actual) || actual.length !== w.length) {
      out.push(`${path}: expected ${w.length} entries, got ${Array.isArray(actual) ? actual.length : String(actual)}`);
      return;
    }
    w.forEach((item, i) => differences(actual[i], item, `${path}[${i}]`, out));
    return;
  }
  if (typeof actual !== 'object' || actual === null) {
    out.push(`${path}: expected an object, got ${String(actual)}`);
    return;
  }
  const record = actual as Record<string, unknown>;
  for (const key of Object.keys(w)) {
    const wanted = w[key];
    if (wanted === undefined) continue;
    if (!(key in record)) {
      out.push(`${path}.${key}: missing`);
      continue;
    }
    differences(record[key], wanted, `${path}.${key}`, out);
  }
}

/** "Lines 3, 13, 14" or "Line 16" as numbers, read by walking the text. */
function linesOf(text: string): number[] {
  const out: number[] = [];
  let value = 0;
  let inNumber = false;
  for (const ch of text) {
    const digit = ch.charCodeAt(0) - 48;
    if (digit >= 0 && digit <= 9) {
      value = value * 10 + digit;
      inNumber = true;
    } else if (inNumber) {
      out.push(value);
      value = 0;
      inNumber = false;
    }
  }
  if (inNumber) out.push(value);
  return out;
}

function asObj(v: Json | undefined): Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? v : {};
}

function asArr(v: Json | undefined): Json[] {
  return Array.isArray(v) ? v : [];
}

/** The sketch's tile report, reshaped to the port's names. Sentences become a count. */
function reshapeTile(p: Obj): Obj {
  const out: Obj = { issues: asArr(p['issues']).length, level: p['level'] ?? null, stop: p['stop'] ?? false };
  const reach = (r: Json | undefined): Json => {
    if (r === null || r === undefined) return null;
    const o = asObj(r);
    return { key: o['key'] ?? null, walkMin: o['walk'] ?? 0, segments: o['segs'] ?? null };
  };
  if ('ring' in p) out['ring'] = reach(p['ring']);
  if ('fields' in p) out['fields'] = reach(p['fields']);
  for (const k of ['load', 'cap', 'needs', 'schools', 'goes', 'stuck']) if (k in p) out[k] = p[k] ?? null;
  return out;
}

function reshapeEvaluation(r: Obj): Obj {
  const per: Obj = {};
  const recordedPer = asObj(r['per']);
  for (const k of Object.keys(recordedPer)) per[k] = reshapeTile(asObj(recordedPer[k]));
  const checks = asArr(r['rules']).map((rule) => {
    const o = asObj(rule);
    return { id: o['id'] ?? '', lines: linesOf(String(o['lines'] ?? '')), status: o['status'] ?? '', tiles: o['tiles'] ?? [] };
  });
  const tests = asArr(r['tests']).map((t) => {
    const o = asObj(t);
    const out: Obj = { id: o['id'] ?? '', gives: asArr(o['gives']).map((g) => ({ id: asObj(g)['id'] ?? '', status: asObj(g)['status'] ?? '' })) };
    if (o['id'] === 'closure') {
      out['edge'] = o['edge'] ?? null;
      out['weak'] = o['weak'] ?? 0;
      out['lines'] = o['lines'] ?? 0;
    }
    return out;
  });
  return { per, checks, score: r['score'] ?? {}, pop1: r['pop1'] ?? 0, stress: r['stress'] ?? {}, tests, showing: r['showing'] ?? null, today: r['today'] ?? {} };
}

/** The port's assessment with its issues counted, so it compares with the reshaped record. */
function countIssues(assessment: ReturnType<typeof assess>): unknown {
  const per: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(assessment.per)) per[k] = { ...p, issues: p.issues.length };
  return { ...assessment, per };
}

describe('rates from the ledger', () => {
  it('match the sketch', () => {
    const r = fixture.rates;
    const out: string[] = [];
    differences(RATES.hood, r['HOOD'] ?? 0, 'hood', out);
    differences(RATES.tileKm, r['TILE_KM'] ?? 0, 'tileKm', out);
    differences(RATES.stepKm, r['STEP_KM'] ?? 0, 'stepKm', out);
    differences(RATES.tileAcres, r['TILE_ACRES'] ?? 0, 'tileAcres', out);
    differences(RATES.inTile, r['IN_TILE'] ?? 0, 'inTile', out);
    differences(RATES.foot, r['FOOT'] ?? 0, 'foot', out);
    differences(RATES.longKm, r['LONG_KM'] ?? 0, 'longKm', out);
    differences(RATES.ringServes, r['RING_SERVES'] ?? 0, 'ringServes', out);
    differences(RATES.band, r['BAND'] ?? 0, 'band', out);
    // The sketch's board is a hexagon; the city's is a rectangle that holds it (ADR-0006). Parity on the outline is
    // that the sketch's hexagon has the recorded tile count and every one of its tiles is inside the city's outline.
    const sketch = allTiles(hexagon(Number(r['BOARD'] ?? 0)));
    differences(sketch.length, r['tiles'] ?? 0, 'tiles', out);
    const city = allTiles(RATES.outline);
    for (const k of sketch) if (!city.includes(k)) out.push(`tile ${k} of the sketch's board is outside the city's outline`);
    differences(RATES.share, r['SHARE'] ?? {}, 'share', out);
    expect(out).toEqual([]);
  });
});

describe('assessment parity with the sketch', () => {
  for (const c of fixture.evaluations) {
    it(`${c.name}: checks, tiles, score and stretch tests match`, () => {
      const options: { show?: TestId | null; now?: Stress | null } = {};
      if (c.showing) options.show = c.showing;
      if (c.now) options.now = c.now;
      const got = countIssues(assess(c.state, RATES, options));
      const out: string[] = [];
      differences(got, reshapeEvaluation(c.result), c.name, out);
      expect(out).toEqual([]);
    });
  }
});

function run(a: Act): Outcome | null {
  const extras: readonly string[] = ['elementary', 'middle', 'high', 'fields'];
  if (a.tool === 'hood') return placeNeighborhood(a.before, a.key, RATES);
  if (a.tool === 'ring') return addRingBuilding(a.before, a.key, RATES);
  if (extras.includes(a.tool)) return toggleExtra(a.before, a.key, a.tool as ExtraKind, RATES);
  if (isPlantKind(a.tool)) return addPlantUnit(a.before, a.key, a.tool, RATES);
  if (a.tool === 'erase') return erase(a.before, a.key, RATES);
  if (a.tool === 'line') return a.from === null ? null : layStretch(a.before, a.from, a.key, RATES);
  throw new Error(`no command for ${a.tool}`);
}

describe('command parity with the sketch', () => {
  fixture.acts.forEach((a, i) => {
    it(`move ${i + 1}: ${a.tool} at ${a.key} (${a.changed ? 'changed' : 'refused'}: "${a.said}")`, () => {
      const outcome = run(a);
      if (outcome === null) {
        // A line click with nothing to continue from is the Board's cursor, not a command.
        expect(a.changed).toBe(false);
        return;
      }
      expect(outcome.ok).toBe(a.changed);
      if (outcome.ok) expect(outcome.layout).toEqual(a.after);
      else expect(a.before).toEqual(a.after);
    });
  });
});

describe('seating parity with the sketch', () => {
  for (const c of fixture.seatingCases) {
    it(c.name, () => {
      const minutes = (t: string, p: string): number => c.minutes[t]?.[p] ?? 99;
      const out: string[] = [];
      differences(seat(c.takers, c.places, minutes, c.limit), c.result, c.name, out);
      expect(out).toEqual([]);
    });
  }
});

describe('restoring a layout from storage', () => {
  for (const c of fixture.cleanCases) {
    it(c.name, () => {
      expect(restoreLayout(c.raw, RATES)).toEqual(c.result);
    });
  }
});

describe('bridges and closable stretches', () => {
  for (const c of fixture.bridgeCases) {
    it(c.name, () => {
      expect(bridges(c.state)).toEqual(c.result);
      expect(closable(c.state)).toEqual(c.closable);
    });
  }
});
