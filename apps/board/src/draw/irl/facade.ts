/**
 * @file Procedural facades: what a building's face looks like, described in metres and colours so the GL adapter can
 * paint it into a texture and a test can count it. A townhouse front is one sheet the size of the home (two bays,
 * three floors, a door on the ground floor) in one of four materials; an office floor and a plant wall are sheets
 * that repeat. Pure, deterministic: the same variant is the same sheet every frame and every load (ADR-0023 Decision 3).
 * Public interface: Rect, FacadeSheet, HomeVariant, HOME_VARIANTS, STOREY_M, homeFacade, officeFacade, plantFacade,
 * variantOf, hashOf, randomOf.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view).
 */
import { STORY_M } from '../angled/extrude.ts';

/** A rectangle on a facade: metres along the front from its left, metres up from the ground, width and height. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One sheet of facade: its size, its colours, and where the openings are. */
export interface FacadeSheet {
  readonly widthM: number;
  readonly heightM: number;
  /** The wall's colour, CSS hex. */
  readonly wall: string;
  /** Window frames, sills and the door's frame. */
  readonly trim: string;
  /** The glass by day. */
  readonly glass: string;
  /** The door, when there is one. */
  readonly door: Rect | null;
  readonly windows: readonly Rect[];
  /** Sills and bands: thin ledges drawn in the trim colour. */
  readonly ledges: readonly Rect[];
  /** Whether the sheet repeats across a face (an office floor) or is one face (a home). */
  readonly repeats: boolean;
  /** The roof's colour, for the geometry above the sheet. */
  readonly roof: string;
}

/** The four materials a townhouse comes in. */
export type HomeVariant = 0 | 1 | 2 | 3;

/** How many. */
export const HOME_VARIANTS = 4;

/** Metres a storey, the angled view's (Mine). */
export const STOREY_M = STORY_M;

/** Wall, trim, roof by variant: red brick, pale render, grey stone, dark timber. */
const HOME_LOOKS: readonly { wall: string; trim: string; roof: string }[] = [
  { wall: '#9A5B45', trim: '#F2EBDD', roof: '#4A3F3A' },
  { wall: '#E6DFCF', trim: '#5A5F57', roof: '#6A4F43' },
  { wall: '#8E8C84', trim: '#F4F1EA', roof: '#3D4247' },
  { wall: '#4E4A44', trim: '#D9CDB4', roof: '#2E2B29' },
];

/** A small deterministic hash of a string (FNV-1a), never 0. */
export function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h || 1;
}

/** A seeded source of numbers in [0, 1): a linear congruential generator, the same stream for the same seed. */
export function randomOf(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** The variant a home takes from its seed. */
export function variantOf(seed: number): HomeVariant {
  return ((seed >>> 8) % HOME_VARIANTS) as HomeVariant;
}

/**
 * A townhouse front: so many bays of one window each a floor, a door in the first bay on the ground floor, a sill
 * under every window and a band at each floor.
 * @param variant - which material
 * @param frontM - the home's front, metres (the Ledger's 6)
 * @param stories - floors (the Ledger's 3)
 */
export function homeFacade(variant: HomeVariant, frontM = 6, stories = 3): FacadeSheet {
  const look = HOME_LOOKS[variant] ?? (HOME_LOOKS[0] as { wall: string; trim: string; roof: string });
  const bays = Math.max(1, Math.round(frontM / 3));
  const bay = frontM / bays;
  const win = { w: Math.min(1.3, bay * 0.45), h: 1.5 };
  const windows: Rect[] = [];
  const ledges: Rect[] = [];
  let door: Rect | null = null;
  for (let floor = 0; floor < stories; floor++) {
    const base = floor * STOREY_M;
    for (let b = 0; b < bays; b++) {
      const cx = (b + 0.5) * bay;
      if (floor === 0 && b === 0) {
        door = { x: cx - 0.5, y: 0, w: 1.0, h: 2.2 };
        continue;
      }
      windows.push({ x: cx - win.w / 2, y: base + 1.0, w: win.w, h: win.h });
      ledges.push({ x: cx - win.w / 2 - 0.1, y: base + 0.9, w: win.w + 0.2, h: 0.1 });
    }
    if (floor > 0) ledges.push({ x: 0, y: base - 0.08, w: frontM, h: 0.16 });
  }
  return { widthM: frontM, heightM: stories * STOREY_M, wall: look.wall, trim: look.trim, glass: '#7D93A6', door, windows, ledges, repeats: false, roof: look.roof };
}

/** One floor of a ring building, repeating: four bays of glass between mullions, a slab band at the floor. */
export function officeFacade(): FacadeSheet {
  const width = 6;
  const bays = 4;
  const bay = width / bays;
  const windows: Rect[] = [];
  for (let b = 0; b < bays; b++) windows.push({ x: b * bay + 0.15, y: 0.5, w: bay - 0.3, h: STOREY_M - 0.7 });
  return { widthM: width, heightM: STOREY_M, wall: '#B9C1C6', trim: '#6F787E', glass: '#5C7A94', door: null, windows, ledges: [{ x: 0, y: 0, w: width, h: 0.45 }], repeats: true, roof: '#8A9196' };
}

/** A plant's wall, repeating: concrete with one high narrow window a bay. */
export function plantFacade(): FacadeSheet {
  const width = 8;
  return { widthM: width, heightM: 2 * STOREY_M, wall: '#A8ABA4', trim: '#5F655F', glass: '#6E7F8C', door: null, windows: [{ x: 3, y: 4.2, w: 2, h: 1.0 }], ledges: [{ x: 0, y: 0, w: width, h: 0.3 }], repeats: true, roof: '#787C78' };
}
