/**
 * @file Streets and open ground from the Ground's own numbers (ADR-0024 Decision 3): a neighborhood's lines of rows
 * face alternately, so between an odd line and the next even one fronts face fronts and the 12 m gap is a street, an
 * 8 m shared surface between two 2 m sidewalks with kerbs, a crossing at each end; the other gaps are gardens. The
 * bike lane runs the Ground's three edges. A park gets a ring path and a cross; the center and the ring's plaza are
 * paved and ringed with lamps and planters from the kit. Pure, no DOM: records in scene metres (x east, y south)
 * that the describer turns into prisms and props, and a test can count.
 * Public interface: SurfaceKind, Strip, Prop, Streets, STREET_M, SIDEWALK_M, CROSSING_M, PATH_M, LANE_M, streetsOf,
 * plazaOf.
 * Owner context: Board (adapter), the IRL view (plan simcity-detail-city).
 */
import type { Disc, NeighborhoodPlan, Point, RingPlan, Segment } from '@city/ground';

/** What a flat strip is paved with. */
export type SurfaceKind = 'asphalt' | 'sidewalk' | 'kerb' | 'crossing' | 'lane' | 'parkpath' | 'plaza';

/** A flat polygon on the ground, metres, with what it is paved with. */
export interface Strip {
  readonly kind: SurfaceKind;
  readonly corners: readonly Point[];
}

/** A kit model placed on the ground: which, where, which way it faces (radians from facing south), and how tall. */
export interface Prop {
  readonly model: string;
  readonly x: number;
  readonly y: number;
  readonly yaw: number;
  readonly heightM: number;
}

/** A neighborhood's streets and open ground, and the sums a test holds them to. */
export interface Streets {
  readonly strips: readonly Strip[];
  readonly props: readonly Prop[];
  /** Streets laid (one a pair of facing lines). */
  readonly streets: number;
  readonly crossings: number;
}

/** The shared surface between the sidewalks, metres (Mine; the Ground's 12 m gap less two sidewalks). */
export const STREET_M = 8;
/** A sidewalk, metres (Mine). */
export const SIDEWALK_M = 2;
/** A crossing's length along the street, metres (Mine). */
export const CROSSING_M = 4;
/** A park path, metres wide (Mine). */
export const PATH_M = 2.5;
/** The bike lane, metres wide (Mine). */
export const LANE_M = 3;
/** The kerb, metres wide (Mine). */
const KERB_M = 0.25;
/** The lamp's height, metres (Mine). */
const LAMP_M = 6;

const cm = (v: number): number => Math.round(v * 100) / 100;

/** A rectangle between two x's and two y's, shifted to a tile's middle. */
function rect(x0: number, x1: number, y0: number, y1: number, at: Point): Point[] {
  return [
    { x: at.x + x0, y: at.y + y0 },
    { x: at.x + x1, y: at.y + y0 },
    { x: at.x + x1, y: at.y + y1 },
    { x: at.x + x0, y: at.y + y1 },
  ];
}

/** A segment as a strip so wide, shifted to a tile's middle. */
function along(seg: Segment, widthM: number, at: Point): Point[] {
  const dx = seg.to.x - seg.from.x;
  const dy = seg.to.y - seg.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (widthM / 2);
  const ny = (dx / len) * (widthM / 2);
  return [
    { x: at.x + seg.from.x + nx, y: at.y + seg.from.y + ny },
    { x: at.x + seg.to.x + nx, y: at.y + seg.to.y + ny },
    { x: at.x + seg.to.x - nx, y: at.y + seg.to.y - ny },
    { x: at.x + seg.from.x - nx, y: at.y + seg.from.y - ny },
  ];
}

/** A ring of so many sides between two radii, as one polygon per side, shifted to a tile's middle. */
function ringPath(disc: Disc, inner: number, outer: number, sides: number, at: Point): Point[][] {
  const out: Point[][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * 2 * Math.PI;
    const b = ((i + 1) / sides) * 2 * Math.PI;
    out.push([
      { x: at.x + disc.at.x + inner * Math.cos(a), y: at.y + disc.at.y + inner * Math.sin(a) },
      { x: at.x + disc.at.x + outer * Math.cos(a), y: at.y + disc.at.y + outer * Math.sin(a) },
      { x: at.x + disc.at.x + outer * Math.cos(b), y: at.y + disc.at.y + outer * Math.sin(b) },
      { x: at.x + disc.at.x + inner * Math.cos(b), y: at.y + disc.at.y + inner * Math.sin(b) },
    ]);
  }
  return out;
}

/** Lamps and planters round a paved disc, alternating, so many of each, facing the middle. */
function furnish(disc: Disc, at: Point, count: number): Prop[] {
  const props: Prop[] = [];
  const r = disc.radiusM - 3;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 2 * Math.PI;
    const x = at.x + disc.at.x + r * Math.cos(a);
    const y = at.y + disc.at.y + r * Math.sin(a);
    // Facing south is yaw 0; a prop faces the middle, which lies back along its angle.
    const yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
    props.push(i % 2 === 0 ? { model: 'lamp-double', x, y, yaw, heightM: LAMP_M } : { model: 'planter', x, y, yaw, heightM: 1 });
  }
  return props;
}

/**
 * A neighborhood's streets and open ground. The lines of rows are the distinct y's of its rows; line i faces north
 * when i is even and south when odd (as the homes are placed), so a street lies between an odd line and the even one
 * after it when the two are one pitch apart (a wider gap holds the park or the center and gets no street); the
 * street spans the union of the two lines' rows, with a crossing at each end. The bike lane runs the plan's lane;
 * the park gets a ring path and a cross path; the center is paved and furnished.
 * @param plan - the Ground's neighborhood
 * @param at - the tile's middle, scene metres
 */
export function streetsOf(plan: NeighborhoodPlan, at: Point): Streets {
  const strips: Strip[] = [];
  const props: Prop[] = [];
  const ys = [...new Set(plan.surface.rows.map((r) => cm(r.y)))].sort((a, b) => a - b);
  const pitch = plan.figures.rowPitchM;
  const depth = plan.figures.rowDepthM;
  let streets = 0;
  let crossings = 0;
  for (let i = 1; i + 1 < ys.length; i += 2) {
    const yA = ys[i] as number;
    const yB = ys[i + 1] as number;
    if (Math.abs(yB - yA - pitch) > 1e-6) continue;
    const rows = plan.surface.rows.filter((r) => cm(r.y) === yA || cm(r.y) === yB);
    const x0 = Math.min(...rows.map((r) => r.x0));
    const x1 = Math.max(...rows.map((r) => r.x1));
    // Line A faces south: its fronts are at yA + depth/2; line B faces north: its fronts at yB - depth/2.
    const top = yA + depth / 2;
    const bottom = yB - depth / 2;
    const gap = bottom - top;
    const side = Math.min(SIDEWALK_M, Math.max(0, (gap - STREET_M) / 2));
    // The kerb is the sidewalk's last quarter metre, so the shared surface keeps its full width.
    strips.push({ kind: 'sidewalk', corners: rect(x0, x1, top, top + side - KERB_M, at) });
    strips.push({ kind: 'kerb', corners: rect(x0, x1, top + side - KERB_M, top + side, at) });
    strips.push({ kind: 'asphalt', corners: rect(x0, x1, top + side, bottom - side, at) });
    strips.push({ kind: 'kerb', corners: rect(x0, x1, bottom - side, bottom - side + KERB_M, at) });
    strips.push({ kind: 'sidewalk', corners: rect(x0, x1, bottom - side + KERB_M, bottom, at) });
    strips.push({ kind: 'crossing', corners: rect(x0, x0 + CROSSING_M, top + side, bottom - side, at) });
    strips.push({ kind: 'crossing', corners: rect(x1 - CROSSING_M, x1, top + side, bottom - side, at) });
    streets++;
    crossings += 2;
  }
  for (const seg of plan.surface.lane) strips.push({ kind: 'lane', corners: along(seg, LANE_M, at) });
  const park = plan.surface.park;
  for (const poly of ringPath(park, park.radiusM - 8 - PATH_M, park.radiusM - 8, 24, at)) strips.push({ kind: 'parkpath', corners: poly });
  strips.push({ kind: 'parkpath', corners: rect(park.at.x - PATH_M / 2, park.at.x + PATH_M / 2, park.at.y - park.radiusM + 8, park.at.y + park.radiusM - 8, at) });
  strips.push({ kind: 'parkpath', corners: rect(park.at.x - park.radiusM + 8, park.at.x + park.radiusM - 8, park.at.y - PATH_M / 2, park.at.y + PATH_M / 2, at) });
  props.push(...furnish(plan.surface.center, at, 12));
  return { strips, props, streets, crossings };
}

/** The ring's plaza: paved and furnished round its edge. */
export function plazaOf(plan: RingPlan, at: Point): Streets {
  return { strips: [], props: furnish(plan.surface.plaza, at, 16), streets: 0, crossings: 0 };
}
