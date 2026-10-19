/**
 * @file The angled view's camera: ground points in metres, with a height, to screen pixels and back. A pure
 * projection with no DOM: yaw turns the ground, pitch tilts it (a right angle is the plan view, zero is side on),
 * the scale is pixels a metre, and the origin is where the ground's origin lands on the screen. Nearer things are
 * lower on the screen and drawn later; `depthOf` gives that order.
 * Public interface: Camera, GroundPoint, ScreenPoint, cameraAt, project, unproject, depthOf, turned, DEFAULT_CAMERA.
 * Owner context: Board (adapter), the angled view (plan angled-view-through-time).
 */

/** A point on the ground, in metres, at a height above it. */
export interface GroundPoint {
  readonly x: number;
  readonly y: number;
  /** Metres above the ground; absent is 0. */
  readonly z?: number;
}

/** A point on the screen, in pixels. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Where the viewer stands. */
export interface Camera {
  /** Turn of the ground about the vertical, radians, counter-clockwise seen from above. */
  readonly yaw: number;
  /** Angle between the view and the ground, radians, in (0, π/2]: π/2 is the plan view, smaller is more side on. */
  readonly pitch: number;
  /** Pixels a metre on the ground across the screen. */
  readonly scale: number;
  /** Where the ground's origin lands on the screen. */
  readonly origin: ScreenPoint;
}

/** A gentle tilt, a quarter turn of yaw, one pixel a metre, the origin at the screen's origin. */
export const DEFAULT_CAMERA: Camera = { yaw: 0, pitch: Math.PI / 3, scale: 1, origin: { x: 0, y: 0 } };

/** A camera, checked: the pitch must be in (0, π/2] and the scale positive. */
export function cameraAt(camera: Camera): Camera {
  if (!(camera.pitch > 0 && camera.pitch <= Math.PI / 2)) throw new RangeError(`pitch ${camera.pitch} is not in (0, π/2]`);
  if (!(camera.scale > 0)) throw new RangeError(`scale ${camera.scale} is not positive`);
  return camera;
}

/** The ground point turned by the camera's yaw: x across the screen, y toward the viewer. */
export function turned(p: GroundPoint, camera: Camera): { readonly x: number; readonly y: number } {
  const c = Math.cos(camera.yaw);
  const s = Math.sin(camera.yaw);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/**
 * A ground point at a height, on the screen.
 * @param p - the point in metres, with its height
 * @param camera - the viewer
 * @returns pixels: x across, y down; a height lifts the point up the screen by its cosine of the pitch
 */
export function project(p: GroundPoint, camera: Camera): ScreenPoint {
  const t = turned(p, camera);
  const z = p.z ?? 0;
  return {
    x: camera.origin.x + t.x * camera.scale,
    y: camera.origin.y + (t.y * Math.sin(camera.pitch) - z * Math.cos(camera.pitch)) * camera.scale,
  };
}

/**
 * The ground point under a screen point, at a stated height: the inverse of `project` for that height.
 * @param s - the screen point in pixels
 * @param camera - the viewer
 * @param z - the height the point is taken at, metres; 0 is the ground
 */
export function unproject(s: ScreenPoint, camera: Camera, z = 0): GroundPoint {
  const tx = (s.x - camera.origin.x) / camera.scale;
  const ty = ((s.y - camera.origin.y) / camera.scale + z * Math.cos(camera.pitch)) / Math.sin(camera.pitch);
  const c = Math.cos(camera.yaw);
  const sn = Math.sin(camera.yaw);
  return { x: tx * c + ty * sn, y: -tx * sn + ty * c, z };
}

/**
 * How near the viewer a ground point is: larger is nearer, and nearer is drawn later (the painter's order). Height
 * does not change it, so a building's faces sort with its footprint.
 */
export function depthOf(p: GroundPoint, camera: Camera): number {
  return turned(p, camera).y;
}
