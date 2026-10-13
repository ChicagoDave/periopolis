/**
 * @file Choosing a level of a plan: the surface or the sub level, of a neighborhood or the ring.
 * Public interface: layersAt.
 * Owner context: Ground (domain).
 */
import type { GroundPlan, Layer, Level, NeighborhoodPlan, RingPlan, RingSub, RingSurface, SubLevel, Surface } from './plan.ts';

/**
 * The shapes of one level of a plan, and nothing from the other.
 * @param plan - a neighborhood's or the ring's plan
 * @param level - 'surface' or 'sub'
 * @returns that level's layer, carrying `of` and `level` so the Board can tell which it holds
 */
export function layersAt(plan: NeighborhoodPlan, level: 'surface'): Surface;
export function layersAt(plan: NeighborhoodPlan, level: 'sub'): SubLevel;
export function layersAt(plan: RingPlan, level: 'surface'): RingSurface;
export function layersAt(plan: RingPlan, level: 'sub'): RingSub;
export function layersAt(plan: GroundPlan, level: Level): Layer;
export function layersAt(plan: GroundPlan, level: Level): Layer {
  return level === 'surface' ? plan.surface : plan.sub;
}
