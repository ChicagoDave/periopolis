/**
 * @file The sun from a time of day (ADR-0024 Decision 5): where it stands and how much daylight there is, as a pure
 * function of the hour. A simple day: the sun rises in the east at six, stands highest in the south at noon, sets
 * in the west at eighteen, and is below the horizon at night; daylight fades over the hour round sunrise and
 * sunset. Four presets name the slider's stops. No seasons, no latitude: a view control, never saved.
 * Public interface: SunAt, Preset, PRESETS, PRESET_HOURS, MAX_ELEVATION, sunAt, daylightOf, presetOf, nextPreset.
 * Owner context: Board (adapter), the IRL view (plan simcity-detail-city).
 */

/** Where the sun stands: its elevation above the horizon (negative below), its azimuth measured from east over
 * south to west (scene x east, y south), and the daylight share, 0 at night to 1 in full day. */
export interface SunAt {
  readonly elevation: number;
  readonly azimuth: number;
  readonly daylight: number;
  /** Unit direction toward the sun in scene metres: x east, y south, z up. */
  readonly direction: { readonly x: number; readonly y: number; readonly z: number };
}

/** The slider's named stops. */
export type Preset = 'dawn' | 'noon' | 'dusk' | 'night';

/** In the order the button steps through them. */
export const PRESETS: readonly Preset[] = ['dawn', 'noon', 'dusk', 'night'];

/** The hour each preset sets. */
export const PRESET_HOURS: Readonly<Record<Preset, number>> = { dawn: 6.5, noon: 12, dusk: 18, night: 23 };

/** The sun's highest elevation, at noon: sixty degrees (Mine). */
export const MAX_ELEVATION = (60 * Math.PI) / 180;

/** Sunrise and sunset, hours. */
const RISE = 6;
const SET = 18;

/** Daylight from elevation: none six degrees under the horizon, full ten degrees above, smooth between. */
export function daylightOf(elevation: number): number {
  const lo = (-6 * Math.PI) / 180;
  const hi = (10 * Math.PI) / 180;
  const t = Math.max(0, Math.min(1, (elevation - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

/**
 * The sun at an hour of the day.
 * @param hour - 0 to 24; values outside wrap round the day
 */
export function sunAt(hour: number): SunAt {
  const h = ((hour % 24) + 24) % 24;
  // The day's arc: a half turn from sunrise to sunset; before and after, the sun is as far under as it would be over.
  const arc = ((h - RISE) / (SET - RISE)) * Math.PI;
  const elevation = Math.sin(arc) * MAX_ELEVATION;
  const azimuth = arc;
  const flat = Math.cos(elevation);
  return {
    elevation,
    azimuth,
    daylight: daylightOf(elevation),
    direction: { x: Math.cos(azimuth) * flat, y: Math.sin(azimuth) * flat, z: Math.sin(elevation) },
  };
}

/** The preset an hour is at, or null when it is between stops. */
export function presetOf(hour: number): Preset | null {
  for (const p of PRESETS) if (Math.abs(PRESET_HOURS[p] - hour) < 1e-9) return p;
  return null;
}

/** The preset after an hour: the next stop later in the day, round to dawn. */
export function nextPreset(hour: number): Preset {
  for (const p of PRESETS) if (PRESET_HOURS[p] > hour + 1e-9) return p;
  return 'dawn';
}
