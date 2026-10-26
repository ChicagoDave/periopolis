/**
 * @file The kit held to numbers: every packed model is CC0 and under the asset budget; a townhouse fitted by its
 * front spans the Ground's 6 m exactly, stands on the ground with its front face at the plot's street edge and rises
 * about three storeys; a tower fitted to its plot spans it; the townhouse a home takes is the same for the same home
 * and spread across the kit; and a model the manifest lacks is refused.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { planNeighborhood, planRing } from '@city/ground';
import { RATES } from '@city/site';
import { STORY_M } from '../src/draw/angled/extrude.ts';
import { MANIFEST, TOWERS, TOWNHOUSES, assetBudget, fitToFootprint, fitToFront, fittedBox, modelOf, townhouseFor } from '../src/draw/irl/kit.ts';

const hood = planNeighborhood(RATES.shared, RATES.walking, RATES.base);
const close = (a: number, b: number, eps = 1e-6): void => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('the manifest', () => {
  it('holds CC0 models only, within the budget, with a source and a native box each, and the kit ids all present', () => {
    expect(MANIFEST.models.length).toBeGreaterThan(30);
    for (const m of MANIFEST.models) {
      expect(m.licence).toBe('CC0 1.0');
      expect(m.source.startsWith('https://kenney.nl/')).toBe(true);
      expect(m.native.size.every((v) => v > 0)).toBe(true);
      expect(m.bytes).toBeGreaterThan(0);
    }
    expect(MANIFEST.totalBytes).toBe(MANIFEST.models.reduce((t, m) => t + m.bytes, 0));
    expect(MANIFEST.totalBytes).toBeLessThan(assetBudget.firstPaint);
    for (const id of [...TOWNHOUSES, ...TOWERS, 'pod', 'cab', 'shuttle', 'tree-small', 'tree-large']) expect(modelOf(id).id).toBe(id);
    expect(() => modelOf('castle')).toThrow(RangeError);
  });
});

describe('fitting', () => {
  const front = hood.surface.rows[0] ? hood.surface.rows[0].frontageM / hood.surface.rows[0].homes : 6;
  const depth = hood.figures.rowDepthM;
  it("a townhouse by its front spans the Ground's front to the millimetre, stands on the ground, its front face at the street edge, and rises about three storeys", () => {
    for (const id of TOWNHOUSES) {
      const fit = fitToFront(id, front, depth);
      const box = fittedBox(id, fit);
      close(box.max[0] - box.min[0], front, 1e-3);
      close(box.min[0], -front / 2, 1e-3);
      close(box.min[1], 0, 1e-6);
      close(box.min[2], -depth / 2, 1e-6);
      expect(box.max[2]).toBeLessThanOrEqual(depth / 2 + 1e-6);
      const storeys = box.max[1] / STORY_M;
      expect(storeys).toBeGreaterThan(id === 'townhouse-c' ? 1.5 : 2.4);
      expect(storeys).toBeLessThan(3.6);
    }
    expect(() => fitToFront('townhouse-a', 0, depth)).toThrow(RangeError);
  });
  it("a tower to its plot spans the ring building's side, centred, on the ground", () => {
    const ring = planRing(RATES.walking, RATES.base, 8);
    const side = ring.figures.sideM;
    for (const id of TOWERS) {
      const fit = fitToFootprint(id, side);
      const box = fittedBox(id, fit);
      close(Math.max(box.max[0] - box.min[0], box.max[2] - box.min[2]), side, 1e-3);
      close(box.min[0] + box.max[0], 0, 1e-3);
      close(box.min[2] + box.max[2], 0, 1e-3);
      close(box.min[1], 0, 1e-6);
      expect(box.max[1]).toBeGreaterThan(side);
    }
    expect(() => fitToFootprint('tower-a', -1)).toThrow(RangeError);
  });
  it('the townhouse a home takes is the same for the same home and spread across the kit', () => {
    expect(townhouseFor('1,0', 7)).toBe(townhouseFor('1,0', 7));
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) taken.add(townhouseFor('1,0', i));
    expect(taken.size).toBe(TOWNHOUSES.length);
    expect(townhouseFor('1,0', 7) === townhouseFor('2,-1', 7) && townhouseFor('1,0', 8) === townhouseFor('2,-1', 8) && townhouseFor('1,0', 9) === townhouseFor('2,-1', 9)).toBe(false);
  });
});
