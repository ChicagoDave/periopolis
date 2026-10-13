/**
 * @file The one random source: a seeded generator, so a run can be replayed from its seed.
 * Public interface: Roll, dice.
 * Owner context: Run (domain).
 */

/** Rolls a number from 0 up to but not including 1. */
export type Roll = () => number;

/**
 * A generator seeded with a whole number. The same seed gives the same rolls.
 * @param seed - any number; it is taken as an unsigned 32-bit whole number
 */
export function dice(seed: number): Roll {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
