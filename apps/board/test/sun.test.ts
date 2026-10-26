/**
 * @file The sun held to numbers: highest in the south at noon, on the eastern horizon at six and the western at
 * eighteen, below it at night; daylight full by day, none at night, fading round sunrise and sunset; the presets and
 * the button's order.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { MAX_ELEVATION, PRESET_HOURS, daylightOf, nextPreset, presetOf, sunAt } from '../src/draw/irl/sun.ts';

const close = (a: number, b: number, eps = 1e-9): void => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('the sun', () => {
  it('stands highest in the south at noon, rises in the east at six and sets in the west at eighteen, and is under the horizon at night', () => {
    const noon = sunAt(12);
    close(noon.elevation, MAX_ELEVATION);
    close(noon.direction.x, 0);
    expect(noon.direction.y).toBeGreaterThan(0);
    close(noon.direction.z, Math.sin(MAX_ELEVATION));
    const rise = sunAt(6);
    close(rise.elevation, 0);
    close(rise.direction.x, 1);
    close(rise.direction.y, 0);
    const set = sunAt(18);
    close(set.elevation, 0);
    close(set.direction.x, -1);
    expect(sunAt(0).elevation).toBeLessThan(0);
    close(sunAt(0).elevation, -MAX_ELEVATION);
    close(sunAt(24).elevation, sunAt(0).elevation);
    close(sunAt(-1).elevation, sunAt(23).elevation);
    for (let h = 0; h < 24; h += 0.25) {
      const d = sunAt(h).direction;
      close(Math.hypot(d.x, d.y, d.z), 1);
    }
  });
  it('daylight is full by day, none at night, and fades round sunrise and sunset', () => {
    expect(sunAt(12).daylight).toBe(1);
    expect(sunAt(0).daylight).toBe(0);
    expect(sunAt(6).daylight).toBeGreaterThan(0);
    expect(sunAt(6).daylight).toBeLessThan(1);
    expect(sunAt(6.5).daylight).toBeGreaterThan(sunAt(6).daylight);
    expect(sunAt(18.5).daylight).toBeLessThan(sunAt(18).daylight);
    // Dusk sits on the horizon, so the sky still shows its colour, and reads as night by daylight's half.
    expect(sunAt(18).daylight).toBeLessThan(0.5);
    expect(sunAt(18).daylight).toBeGreaterThan(0);
    expect(daylightOf(1)).toBe(1);
    expect(daylightOf(-1)).toBe(0);
    close(sunAt(9).daylight, sunAt(15).daylight);
  });
  it('the presets name their hours and the button steps dawn, noon, dusk, night, dawn', () => {
    expect(presetOf(PRESET_HOURS.noon)).toBe('noon');
    expect(presetOf(13)).toBeNull();
    expect(nextPreset(PRESET_HOURS.dawn)).toBe('noon');
    expect(nextPreset(PRESET_HOURS.noon)).toBe('dusk');
    expect(nextPreset(PRESET_HOURS.dusk)).toBe('night');
    expect(nextPreset(PRESET_HOURS.night)).toBe('dawn');
    expect(nextPreset(0)).toBe('dawn');
    expect(nextPreset(13)).toBe('dusk');
  });
});
