/**
 * @file Numbers and words as the page shows them.
 * Public interface: fmt, pct, num, count, list, cap, low, years, money.
 * Owner context: Board (adapter).
 */

/** A number with so many decimals at most, in US style; a dash when it is not finite. */
export const fmt = (x: number, d = 0): string =>
  Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d }) : '–';

/** A share as a whole-number percentage. */
export const pct = (x: number): string => `${fmt(100 * x)}%`;

/** A number with so many decimals at most; the rules' own formatter, which never dashes. */
export const num = (x: number, d = 0): string => x.toLocaleString('en-US', { maximumFractionDigits: d });

/** "1 thing" or "3 things". */
export const count = (n: number, one: string, many: string): string => `${num(n)} ${n === 1 ? one : many}`;

/** "a", "a and b", "a, b and c". */
export const list = (words: readonly string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`;

/** First letter up. */
export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** First letter down. */
export const low = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** "1 year" or "3 years". */
export const years = (n: number): string => `${n}${n === 1 ? ' year' : ' years'}`;

/**
 * Dollars as the page shows them: "$1,750" under a million, "$14.5 M" under a billion, "$14.0 B" above; a minus sign
 * for what comes off; a dash when not finite; "$0" for nothing.
 */
export function money(x: number): string {
  if (!Number.isFinite(x)) return '–';
  const a = Math.abs(x);
  // Less than half a dollar either way is nothing, not a minus sign on nothing.
  const sign = x < -0.5 ? '−' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} B`;
  if (a >= 1e6) return `${sign}$${fmt(a / 1e6, a < 1e7 ? 1 : 0)} M`;
  return `${sign}$${fmt(a)}`;
}
