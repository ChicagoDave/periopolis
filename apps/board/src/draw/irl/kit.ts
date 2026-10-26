/**
 * @file The kit: which packed CC0 model stands for each kind of thing the scene holds, and how a model is fitted to
 * the footprint the Ground fixes (ADR-0024 Decision 1). The manifest the pack script writes gives every model's
 * native box; a fit is one uniform scale and an offset so the model's front spans the footprint's front exactly, its
 * floor sits on the ground and its back edge sits on the footprint's front edge, so a townhouse leaves the rest of
 * its 12 m plot as garden. A model never decides a footprint or a count: the Ground does. Pure, no DOM, no three.js.
 * Public interface: ModelId, ModelEntry, Fit, MANIFEST, TOWNHOUSES, TOWERS, modelOf, townhouseFor, fitToFront,
 * fitToFootprint, fitToHeight, fittedBox, assetBudget.
 * Owner context: Board (adapter), the IRL view (plan simcity-detail-city).
 */
import manifest from '../../../public/assets/manifest.json' with { type: 'json' };
import { hashOf } from './facade.ts';

/** One packed model as the manifest records it. */
export interface ModelEntry {
  readonly id: string;
  readonly kit: string;
  readonly file: string;
  readonly for: string;
  readonly licence: string;
  readonly source: string;
  readonly bytes: number;
  readonly triangles: number;
  /** Its native box in the kit's units: x across, y up, z depth (three's axes). */
  readonly native: { readonly min: readonly number[]; readonly max: readonly number[]; readonly size: readonly number[] };
}

/** The ids the manifest holds. */
export type ModelId = string;

/** The manifest, typed. */
export const MANIFEST: { readonly models: readonly ModelEntry[]; readonly totalBytes: number } = manifest as { models: ModelEntry[]; totalBytes: number };

const byId = new Map<string, ModelEntry>(MANIFEST.models.map((m) => [m.id, m]));

/** The townhouse models a row draws from, three storeys first. */
export const TOWNHOUSES: readonly ModelId[] = ['townhouse-a', 'townhouse-b', 'townhouse-d', 'townhouse-h', 'townhouse-c'];

/** The ring building models. */
export const TOWERS: readonly ModelId[] = ['tower-a', 'tower-b', 'tower-c', 'tower-d', 'tower-e'];

/** The manifest's entry for a model. @throws RangeError when the manifest has no such id */
export function modelOf(id: ModelId): ModelEntry {
  const m = byId.get(id);
  if (!m) throw new RangeError(`no model ${id} in the manifest`);
  return m;
}

/** The townhouse a home takes: one of the kit's, chosen by a seeded hash of its tile and its index in the row. */
export function townhouseFor(key: string, index: number): ModelId {
  return TOWNHOUSES[hashOf(`${key}/${index}`) % TOWNHOUSES.length] as ModelId;
}

/**
 * How a model is placed: one uniform scale, and an offset in three's space (x across, y up, z depth) added after
 * scaling so the box lands where the footprint wants it.
 */
export interface Fit {
  readonly scale: number;
  readonly offset: { readonly x: number; readonly y: number; readonly z: number };
}

/**
 * A model fitted by its front: scaled so its native width spans the front exactly, its floor on the ground, centred
 * across the front, and its back face on the footprint's back line when `depthM` holds it (else its front face on the
 * footprint's front), so a shallow house sits at the street with garden behind.
 * @param id - the model
 * @param frontM - the footprint's front, metres (the Ground's 6 for a townhouse)
 * @param depthM - the footprint's depth, metres; the model's front face is put at -depthM/2 (three's z)
 * @throws RangeError on a front that is not positive
 */
export function fitToFront(id: ModelId, frontM: number, depthM: number): Fit {
  if (!(frontM > 0)) throw new RangeError(`front ${frontM} is not a length`);
  const m = modelOf(id);
  const [w] = m.native.size as [number, number, number];
  const [minX, minY, minZ] = m.native.min as [number, number, number];
  const scale = frontM / w;
  // Centre across, floor to the ground, the front face (native -z side, min z) at the footprint's front edge (-depth/2).
  return {
    scale,
    offset: { x: -(minX + w / 2) * scale, y: -minY * scale, z: -depthM / 2 - minZ * scale },
  };
}

/**
 * A model fitted to a whole footprint by its larger side, centred on it, floor on the ground: for a tower on a
 * square plot or works on a tile.
 * @throws RangeError on a side that is not positive
 */
export function fitToFootprint(id: ModelId, sideM: number): Fit {
  if (!(sideM > 0)) throw new RangeError(`side ${sideM} is not a length`);
  const m = modelOf(id);
  const [w, , d] = m.native.size as [number, number, number];
  const [minX, minY, minZ] = m.native.min as [number, number, number];
  const scale = sideM / Math.max(w, d);
  return { scale, offset: { x: -(minX + w / 2) * scale, y: -minY * scale, z: -(minZ + d / 2) * scale } };
}

/**
 * A model fitted by its height, centred on its own footprint, floor on the ground: for a lamp, a tree or a planter
 * placed as a prop.
 * @throws RangeError on a height that is not positive
 */
export function fitToHeight(id: ModelId, heightM: number): Fit {
  if (!(heightM > 0)) throw new RangeError(`height ${heightM} is not a length`);
  const m = modelOf(id);
  const [w, h, d] = m.native.size as [number, number, number];
  const [minX, minY, minZ] = m.native.min as [number, number, number];
  const scale = heightM / h;
  return { scale, offset: { x: -(minX + w / 2) * scale, y: -minY * scale, z: -(minZ + d / 2) * scale } };
}

/** The box a fitted model occupies, metres, in three's space relative to the footprint's middle on the ground. */
export function fittedBox(id: ModelId, fit: Fit): { readonly min: [number, number, number]; readonly max: [number, number, number] } {
  const m = modelOf(id);
  const lo = m.native.min as [number, number, number];
  const hi = m.native.max as [number, number, number];
  const o = [fit.offset.x, fit.offset.y, fit.offset.z];
  return {
    min: [lo[0] * fit.scale + (o[0] as number), lo[1] * fit.scale + (o[1] as number), lo[2] * fit.scale + (o[2] as number)],
    max: [hi[0] * fit.scale + (o[0] as number), hi[1] * fit.scale + (o[1] as number), hi[2] * fit.scale + (o[2] as number)],
  };
}

/** The asset budget ADR-0024 Decision 4 sets, bytes: in all, and before first paint. */
export const assetBudget = { total: 25 * 1024 * 1024, firstPaint: 8 * 1024 * 1024 } as const;
