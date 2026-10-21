/**
 * @file One month of a city's people (ADR-0009): births and deaths a twelfth of their yearly rates, half of movers
 * leaving, 2,500 a month (30,000 a year) joining the waiting list and moving from it only into empty homes, every
 * premise marked; the homes, not the demand, are the limit (David, 2026-10-21).
 * Owner context: Ledger (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { POPULATION, monthOf } from '../src/index.ts';
import type { PopulationPremises } from '../src/index.ts';

describe('one month of a city\'s people', () => {
  it('a full city of 50,000: births 44.6, deaths 38.3, 181 leave, as many arrive as there are empty homes', () => {
    const m = monthOf(50000, 50000, 0);
    expect(m.births).toBeCloseTo((50000 * 10.7) / 1000 / 12, 9);
    expect(m.deaths).toBeCloseTo((50000 * 9.2) / 1000 / 12, 9);
    expect(m.left).toBeCloseTo((50000 * 0.087 * 0.5) / 12, 9);
    expect(m.births).toBeCloseTo(44.583, 3);
    expect(m.deaths).toBeCloseTo(38.333, 3);
    expect(m.left).toBeCloseTo(181.25, 3);
    const stayed = 50000 + m.births - m.deaths - m.left;
    expect(m.arrived).toBeCloseTo(50000 - stayed, 9);
    expect(m.to).toBeCloseTo(50000, 9);
    // The leavers' homes go to people off the list; the rest of the month's 2,500 wait.
    expect(m.joined).toBe(2500);
    expect(m.waiting).toBeCloseTo(2500 - m.arrived, 9);
  });

  it('an empty neighborhood of 5,000 takes this month\'s 2,500 from an empty list, and they leave the list', () => {
    const m = monthOf(0, 5000, 0);
    expect(m.births).toBe(0);
    expect(m.deaths).toBe(0);
    expect(m.left).toBe(0);
    expect(m.joined).toBe(2500);
    expect(m.arrived).toBe(2500);
    expect(m.to).toBe(2500);
    expect(m.waiting).toBe(0);
  });

  it('a long list fills an empty neighborhood at once and keeps the rest waiting', () => {
    const m = monthOf(0, 5000, 20000);
    expect(m.arrived).toBe(5000);
    expect(m.to).toBe(5000);
    expect(m.waiting).toBe(20000 + 2500 - 5000);
  });

  it('a city with no homes grows its list by 30,000 a year and houses nobody', () => {
    let waiting = 0;
    let people = 0;
    for (let i = 0; i < 12; i++) {
      const m = monthOf(people, 0, waiting);
      people = m.to;
      waiting = m.waiting;
    }
    expect(people).toBe(0);
    expect(waiting).toBeCloseTo(30000, 9);
  });

  it('a city founded empty with 50,000 homes houses its first year\'s 30,000, less the leavers', () => {
    let people = 0;
    let waiting = 0;
    for (let i = 0; i < 12; i++) {
      const m = monthOf(people, 50000, waiting);
      people = m.to;
      waiting = m.waiting;
    }
    expect(waiting).toBe(0);
    expect(people).toBeGreaterThan(29000);
    expect(people).toBeLessThan(30000);
  });

  it('with no empty homes nobody arrives; births in full homes are crowding, not arrivals', () => {
    const k: PopulationPremises = { ...POPULATION, movingShare: { value: 0, mark: { kind: 'mine' } } };
    const m = monthOf(50000, 50000, 1000, k);
    expect(m.arrived).toBe(0);
    expect(m.waiting).toBe(3500);
    expect(m.to).toBeCloseTo(50000 + m.births - m.deaths, 9);
    expect(m.to).toBeGreaterThan(50000);
  });

  it('a city with no homes loses its people and gains none', () => {
    const m = monthOf(1000, 0, 0);
    expect(m.arrived).toBe(0);
    expect(m.to).toBeCloseTo(1000 + m.births - m.deaths - m.left, 9);
  });

  it('refuses negative or missing people, capacity and waiting list, naming the value', () => {
    expect(() => monthOf(-1, 5000, 0)).toThrow(new RangeError('people must be zero or more, not -1'));
    expect(() => monthOf(Number.NaN, 5000, 0)).toThrow(new RangeError('people must be zero or more, not NaN'));
    expect(() => monthOf(100, -5, 0)).toThrow(new RangeError('capacity must be zero or more, not -5'));
    expect(() => monthOf(100, 5000, -1)).toThrow(new RangeError('waiting must be zero or more, not -1'));
    expect(() => monthOf(100, 5000, Number.NaN)).toThrow(new RangeError('waiting must be zero or more, not NaN'));
  });

  it('every population premise carries a mark; the Sourced ones are accepted; half leaving, demand and the childless share stay Mine', () => {
    const marks = Object.entries(POPULATION).map(([id, p]) => [id, p.mark.kind, p.mark.kind === 'sourced' ? p.mark.accepted : null]);
    expect(marks).toEqual([
      ['birthsPerThousand', 'sourced', true],
      ['deathsPerThousand', 'sourced', true],
      ['movingShare', 'sourced', true],
      ['leavingShare', 'mine', null],
      ['demandPerYear', 'mine', null],
      ['childlessShare', 'mine', null],
    ]);
  });
});
