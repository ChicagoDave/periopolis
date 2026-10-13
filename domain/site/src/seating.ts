/**
 * @file Seating: who goes where when places have room for only so many, and the chains of moves that seat the rest.
 * Public interface: Taker, Place, Seat, Seating, seat.
 * Owner context: Site (domain).
 */

/** Someone to seat: a neighborhood's pupils of one kind. */
export interface Taker {
  readonly key: string;
  readonly amount: number;
}

/** Somewhere to seat them: a school with a cap. */
export interface Place {
  readonly key: string;
  readonly cap: number;
}

/** Part of a taker seated at one place. */
export interface Seat {
  readonly to: string;
  readonly amount: number;
  readonly minutes: number;
}

/** Who goes where, each place's load, and who is left out. */
export interface Seating {
  readonly goes: Readonly<Record<string, readonly Seat[]>>;
  readonly load: Readonly<Record<string, number>>;
  readonly left: Readonly<Record<string, number>>;
}

const TINY = 1e-9;

/**
 * Places with room go to the nearest takers first. Anyone still left out is then seated by moving others on to a
 * place farther off, wherever that can be done, so nobody is counted out while a seat for them exists.
 * @param takers - who needs a seat, and how many
 * @param places - where seats are, and how many
 * @param minutes - the walk from a taker to a place
 * @param limit - the longest walk allowed, minutes
 */
export function seat(
  takers: readonly Taker[],
  places: readonly Place[],
  minutes: (taker: string, place: string) => number,
  limit: number,
): Seating {
  const left: Record<string, number> = {};
  const room: Record<string, number> = {};
  const seats: Record<string, Record<string, number>> = {};
  const reach: Record<string, string[]> = {};
  const time: Record<string, number> = {};
  const pairs: { t: string; p: string; m: number }[] = [];
  for (const t of takers) {
    left[t.key] = t.amount;
    seats[t.key] = {};
    reach[t.key] = [];
  }
  for (const p of places) room[p.key] = p.cap;
  for (const t of takers) {
    for (const p of places) {
      const m = minutes(t.key, p.key);
      if (m <= limit) pairs.push({ t: t.key, p: p.key, m });
    }
  }
  pairs.sort((x, y) => x.m - y.m || (x.t < y.t ? -1 : x.t > y.t ? 1 : 0) || (x.p < y.p ? -1 : x.p > y.p ? 1 : 0));
  const seatsOf = (t: string): Record<string, number> => (seats[t] ??= {});
  for (const { t, p, m } of pairs) {
    (reach[t] ??= []).push(p);
    time[`${t}>${p}`] = m;
    const n = Math.min(left[t] ?? 0, room[p] ?? 0);
    if (n <= TINY) continue;
    left[t] = (left[t] ?? 0) - n;
    room[p] = (room[p] ?? 0) - n;
    seatsOf(t)[p] = n;
  }
  // A chain of moves: the one left out takes seats at a full place, whoever held them moves on, and so on until
  // someone lands where there is room. Returns [taker, place, taker, place, ...], ending at the place with room.
  const chain = (from: string): string[] | null => {
    const heldAt: Record<string, string | null> = { [from]: null };
    const wantedBy: Record<string, string> = {};
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const t = queue[i];
      if (t === undefined) break;
      for (const p of reach[t] ?? []) {
        if (p in wantedBy) continue;
        wantedBy[p] = t;
        if ((room[p] ?? 0) > TINY) {
          const path = [p];
          let who: string = t;
          for (;;) {
            path.push(who);
            const held = heldAt[who];
            if (held === null || held === undefined) break;
            path.push(held);
            const next = wantedBy[held];
            if (next === undefined) break;
            who = next;
          }
          return path.reverse();
        }
        for (const other of takers) {
          if (!(other.key in heldAt) && (seatsOf(other.key)[p] ?? 0) > TINY) {
            heldAt[other.key] = p;
            queue.push(other.key);
          }
        }
      }
    }
    return null;
  };
  for (const t of takers) {
    for (let tries = 0; (left[t.key] ?? 0) > TINY && tries < 500; tries++) {
      const path = chain(t.key);
      if (!path) break;
      const last = path[path.length - 1] ?? '';
      let n = Math.min(left[t.key] ?? 0, room[last] ?? 0);
      for (let i = 1; i + 1 < path.length; i += 2) n = Math.min(n, seatsOf(path[i + 1] ?? '')[path[i] ?? ''] ?? 0);
      for (let i = 0; i + 1 < path.length; i += 2) {
        const held = seatsOf(path[i] ?? '');
        held[path[i + 1] ?? ''] = (held[path[i + 1] ?? ''] ?? 0) + n;
      }
      for (let i = 1; i + 1 < path.length; i += 2) {
        const held = seatsOf(path[i + 1] ?? '');
        held[path[i] ?? ''] = (held[path[i] ?? ''] ?? 0) - n;
      }
      left[t.key] = (left[t.key] ?? 0) - n;
      room[last] = (room[last] ?? 0) - n;
    }
  }
  const goes: Record<string, Seat[]> = {};
  const load: Record<string, number> = {};
  for (const p of places) load[p.key] = p.cap - (room[p.key] ?? 0);
  for (const t of takers) {
    goes[t.key] = (reach[t.key] ?? [])
      .filter((p) => (seatsOf(t.key)[p] ?? 0) > TINY)
      .map((p) => ({ to: p, amount: seatsOf(t.key)[p] ?? 0, minutes: time[`${t.key}>${p}`] ?? 0 }));
  }
  return { goes, load, left };
}
