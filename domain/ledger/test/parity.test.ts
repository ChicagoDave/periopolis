/**
 * @file Parity: every figure the port derives matches the sketch's model, recorded in fixtures/parity.json.
 * Owner context: Ledger (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { deriveCarCity, deriveWalkingCity } from '../src/index.ts';
import type { CarCityPremises, Need, SharedPremises, WalkingCityPremises } from '../src/index.ts';
import recorded from './fixtures/parity.json';

/** A recorded value: the sketch's JSON, with Infinity carried as a string. */
type Recorded = number | string | null | boolean | Recorded[] | { [key: string]: Recorded };

interface RecordedCase {
  readonly name: string;
  readonly column: 'car' | 'walking';
  readonly shared: SharedPremises;
  readonly premises: Record<string, Recorded>;
  readonly result: Record<string, Recorded>;
}

const fixtures = recorded as unknown as { needs: Need[]; cases: RecordedCase[] };

/** Keys the port does not carry: the sketch's flags became the column kind, and 'wants' was a scratch field. */
const SKIPPED = new Set(['wants']);

function thaw(v: Recorded): Recorded {
  if (v === 'Infinity') return Infinity;
  if (v === '-Infinity') return -Infinity;
  return v;
}

/** Compare the port's figures against the record, key by key, naming the path of any difference. */
function differences(actual: unknown, want: Recorded, path: string, out: string[]): void {
  const w = thaw(want);
  if (typeof w === 'number') {
    if (typeof actual !== 'number') {
      out.push(`${path}: expected ${w}, got ${String(actual)}`);
      return;
    }
    if (w === actual) return;
    const tolerance = Math.abs(w) * 1e-9 + 1e-12;
    if (!(Math.abs(actual - w) <= tolerance)) out.push(`${path}: expected ${w}, got ${actual}`);
    return;
  }
  if (w === null || typeof w === 'string' || typeof w === 'boolean') {
    if (actual !== w) out.push(`${path}: expected ${String(w)}, got ${String(actual)}`);
    return;
  }
  if (Array.isArray(w)) {
    if (!Array.isArray(actual) || actual.length !== w.length) {
      out.push(`${path}: expected ${w.length} entries`);
      return;
    }
    w.forEach((item, i) => differences(actual[i], item, `${path}[${i}]`, out));
    return;
  }
  if (typeof actual !== 'object' || actual === null) {
    out.push(`${path}: expected an object`);
    return;
  }
  const record = actual as Record<string, unknown>;
  for (const key of Object.keys(w)) {
    if (SKIPPED.has(key)) continue;
    const wanted = w[key];
    if (wanted === undefined) continue;
    // The sketch reports an empty mix for the car city; the port leaves the key to the walking column.
    if (typeof wanted === 'object' && wanted !== null && !Array.isArray(wanted) && Object.keys(wanted).length === 0) continue;
    if (!(key in record)) {
      out.push(`${path}.${key}: missing`);
      continue;
    }
    differences(record[key], wanted, `${path}.${key}`, out);
  }
}

function derive(c: RecordedCase): Record<string, unknown> {
  if (c.column === 'car') {
    const premises = { ...(c.premises as unknown as Omit<CarCityPremises, 'kind'>), kind: 'car' as const };
    return deriveCarCity(c.shared, premises) as unknown as Record<string, unknown>;
  }
  const premises = { ...(c.premises as unknown as Omit<WalkingCityPremises, 'kind'>), kind: 'walking' as const };
  return deriveWalkingCity(c.shared, premises, fixtures.needs) as unknown as Record<string, unknown>;
}

describe('parity with the ledger as published', () => {
  for (const c of fixtures.cases) {
    it(`${c.name}: every recorded figure matches`, () => {
      const out: string[] = [];
      differences(derive(c), c.result, c.column, out);
      expect(out).toEqual([]);
    });
  }

  it('the record covers both columns and the needs', () => {
    expect(fixtures.cases.some((c) => c.column === 'car')).toBe(true);
    expect(fixtures.cases.some((c) => c.column === 'walking')).toBe(true);
    expect(fixtures.needs.length).toBe(15);
  });
});
