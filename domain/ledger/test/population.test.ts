/**
 * @file One month of a city's people (ADR-0009): births and deaths a twelfth of their yearly rates, half of movers
 * leaving, arrivals filling only empty homes at no more than 400 a month (4,800 a year, Irvine 1980–1990), every
 * premise marked, and a new city filling at Irvine's pace rather than by births.
 * Owner context: Ledger (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { POPULATION, monthOf } from '../src/index.ts';
import type { PopulationPremises } from '../src/index.ts';

describe('one month of a city\'s people', () => {
  it('a full city of 50,000: births 44.6, deaths 38.3, 181 leave, as many arrive as there are empty homes', () => {
    const m = monthOf(50000, 50000);
    expect(m.births).toBeCloseTo((50000 * 10.7) / 1000 / 12, 9);
    expect(m.deaths).toBeCloseTo((50000 * 9.2) / 1000 / 12, 9);
    expect(m.left).toBeCloseTo((50000 * 0.087 * 0.5) / 12, 9);
    expect(m.births).toBeCloseTo(44.583, 3);
    expect(m.deaths).toBeCloseTo(38.333, 3);
    expect(m.left).toBeCloseTo(181.25, 3);
    const stayed = 50000 + m.births - m.deaths - m.left;
    expect(m.arrived).toBeCloseTo(50000 - stayed, 9);
    expect(m.to).toBeCloseTo(50000, 9);
  });

  it('an empty neighborhood of 5,000 fills at 400 a month, the citywide pace, not at once', () => {
    const m = monthOf(0, 5000);
    expect(m.births).toBe(0);
    expect(m.deaths).toBe(0);
    expect(m.left).toBe(0);
    expect(m.arrived).toBe(400);
    expect(m.to).toBe(400);
  });

  it('a city founded empty with 50,000 homes reaches about 4,600 people in a year: Irvine\'s pace, less the leavers', () => {
    let people = 0;
    for (let i = 0; i < 12; i++) people = monthOf(people, 50000).to;
    expect(people).toBeGreaterThan(4500);
    expect(people).toBeLessThan(4800);
  });

  it('with no empty homes nobody arrives; births in full homes are crowding, not arrivals', () => {
    const k: PopulationPremises = { ...POPULATION, movingShare: { value: 0, mark: { kind: 'mine' } } };
    const m = monthOf(50000, 50000, k);
    expect(m.arrived).toBe(0);
    expect(m.to).toBeCloseTo(50000 + m.births - m.deaths, 9);
    expect(m.to).toBeGreaterThan(50000);
  });

  it('a city with no homes loses its people and gains none', () => {
    const m = monthOf(1000, 0);
    expect(m.arrived).toBe(0);
    expect(m.to).toBeCloseTo(1000 + m.births - m.deaths - m.left, 9);
  });

  it('refuses negative or missing people and capacity, naming the value', () => {
    expect(() => monthOf(-1, 5000)).toThrow(new RangeError('people must be zero or more, not -1'));
    expect(() => monthOf(Number.NaN, 5000)).toThrow(new RangeError('people must be zero or more, not NaN'));
    expect(() => monthOf(100, -5)).toThrow(new RangeError('capacity must be zero or more, not -5'));
  });

  it('every population premise carries a mark; the Sourced ones are accepted and half leaving stays Mine', () => {
    const marks = Object.entries(POPULATION).map(([id, p]) => [id, p.mark.kind, p.mark.kind === 'sourced' ? p.mark.accepted : null]);
    expect(marks).toEqual([
      ['birthsPerThousand', 'sourced', true],
      ['deathsPerThousand', 'sourced', true],
      ['movingShare', 'sourced', true],
      ['leavingShare', 'mine', null],
      ['arrivalsPerYear', 'sourced', true],
    ]);
  });
});
