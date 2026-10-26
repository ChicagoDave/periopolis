/**
 * @file The GL adapter: the one file that imports three.js. It owns a WebGL renderer on the page's canvas, a sky,
 * a sun that casts soft shadows (or a moon at night), a ground plane, one merged mesh a material for every chunk of
 * the described scene, one instanced mesh of townhouses a size, material variant and light, and one instanced mesh
 * of trees; it paints the procedural facades into textures, rebuilds only the chunks whose signature changed,
 * renders under the orbit camera, resizes with the canvas and survives a lost context. The sub level's meshes are
 * built with the rest and shown on the toggle, which fades the ground and ghosts everything on the surface. It
 * decides nothing about what is built: the describer does (ADR-0023 Decisions 1, 2 and 5). The fleet of movers is
 * three instanced meshes, one a class, placed each frame where the mover module says (Decision 4).
 * Public interface: Tokens, Light, BuildStats, IrlRenderer, webglSupported.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view, ADR-0023).
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  Matrix4,
  InstancedBufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene as GlScene,
  Vector2,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { SunAt } from './sun.ts';
import { sunAt } from './sun.ts';
import { fitToFootprint, fitToFront, fitToHeight } from './kit.ts';
import type { Fit, ModelId } from './kit.ts';
import type { SurfaceKind } from './streets.ts';
import { DARK } from '../angled/canvas.ts';
import type { Palette } from '../angled/canvas.ts';
import { eyeOf } from './camera.ts';
import type { Orbit, Point3 } from './camera.ts';
import { SUB_DEPTH_M } from './describe.ts';
import type { Chunk, Described, HomeInstance, MaterialId, PropInstance, Tree } from './describe.ts';
import { SHORE_SOIL_M } from './describe.ts';
import type { MoverClass, Placed } from './movers.ts';
import type { TrafficClass, TrafficPlaced } from './traffic.ts';
import { homeFacade, officeFacade, plantFacade, HOME_VARIANTS } from './facade.ts';
import type { FacadeSheet, HomeVariant } from './facade.ts';

/** The page's colours the view needs beyond the blocks': the ground and the sky. */
export interface Tokens {
  readonly ground: string;
  readonly sky: string;
}

/** The coarse time of day the city reads as: day, or night with the windows lit by who lives there. */
export type Light = 'noon' | 'night';

/** Past this many milliseconds a frame, the composer (ambient occlusion and bloom) is dropped for a plain render:
 * software GL, where the flows run, cannot carry it. */
const LITE_PAST_MS = 400;

/** What a build did. */
export interface BuildStats {
  /** Chunks whose meshes were built again. */
  readonly rebuilt: number;
  /** Chunks standing. */
  readonly chunks: number;
  /** Townhouse instances standing, and trees. */
  readonly homes: number;
  readonly trees: number;
}

/** Whether the renderer is software: its own name says so. */
function softwareGl(renderer: WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    return ['swiftshader', 'llvmpipe', 'softpipe', 'software'].some((word) => name.includes(word));
  } catch {
    return false;
  }
}

/** Whether the browser can give the canvas a WebGL context at all. */
export function webglSupported(canvas: HTMLCanvasElement): boolean {
  try {
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Scene metres (x east, y south, z up) to three's (x right, y up, z toward the viewer): a turn, not a reflection,
 * so every face keeps its winding. */
function toGl(p: Point3): Vector3 {
  return new Vector3(p.x, p.z, -p.y);
}

/** Pixels a metre a facade is painted at. */
const SHEET_PX_M = 32;

/** The warm light of a lit window at night. */
const WINDOW_LIGHT = '#FFD48A';

/** Metres a townhouse roof rises above its eaves (Mine). */
const ROOF_RISE_M = 2;

/** Paint a facade sheet: the colour map, or the light map (black but for the glass) when `emissive`. */
function paintSheet(sheet: FacadeSheet, emissive: boolean): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(8, Math.round(sheet.widthM * SHEET_PX_M));
  canvas.height = Math.max(8, Math.round(sheet.heightM * SHEET_PX_M));
  const ctx = canvas.getContext('2d');
  const px = canvas.width / sheet.widthM;
  const rect = (r: { x: number; y: number; w: number; h: number }, color: string): void => {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(r.x * px, (sheet.heightM - r.y - r.h) * px, r.w * px, r.h * px);
  };
  if (ctx) {
    ctx.fillStyle = emissive ? '#000000' : sheet.wall;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!emissive) for (const l of sheet.ledges) rect(l, sheet.trim);
    for (const w of sheet.windows) {
      if (!emissive) rect({ x: w.x - 0.08, y: w.y - 0.08, w: w.w + 0.16, h: w.h + 0.16 }, sheet.trim);
      rect(w, emissive ? WINDOW_LIGHT : sheet.glass);
    }
    if (sheet.door && !emissive) {
      rect({ x: sheet.door.x - 0.08, y: 0, w: sheet.door.w + 0.16, h: sheet.door.h + 0.08 }, sheet.trim);
      rect(sheet.door, '#2F2A26');
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = emissive ? SRGBColorSpace : SRGBColorSpace;
  if (sheet.repeats) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1 / sheet.widthM, 1 / sheet.heightM);
  }
  texture.anisotropy = 4;
  return texture;
}

/**
 * A material from a sheet: its colour map and its light map, dark until night. For instances, the light map is
 * scaled by each instance's `aLit` (1 lived in, 0 empty), patched into the standard shader so one mesh holds lit
 * and unlit homes alike and a month that moves people rewrites one attribute.
 */
function sheetMaterial(sheet: FacadeSheet, perInstanceLight = false): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    map: paintSheet(sheet, false),
    emissiveMap: paintSheet(sheet, true),
    emissive: new Color(WINDOW_LIGHT),
    emissiveIntensity: 0,
    roughness: 0.85,
    metalness: 0,
  });
  if (perInstanceLight) litByAttribute(material);
  return material;
}

/**
 * Patch a standard material so its emissive light is scaled by an `aLit` attribute (1 lit, 0 dark), per vertex on
 * a merged mesh or per instance on an instanced one: a far block glows by its occupied share, a townhouse by whether
 * it is lived in, and a month that moves people rewrites one attribute.
 */
function litByAttribute(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLit;\nvarying float vLit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = aLit;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLit;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vLit;');
  };
  material.customProgramCacheKey = () => 'lit-by-attribute';
}

/**
 * One townhouse, in three's space (x along the front, y up, z depth), its front at -z: the box's four walls, two
 * roof slopes to a ridge along x and two gables. Groups: 0 the front and back (the facade sheet), 1 the ends and
 * gables (the wall), 2 the roof.
 */
function homeGeometry(front: number, depth: number, height: number): BufferGeometry {
  const f = front / 2;
  const d = depth / 2;
  const h = height;
  const r = ROOF_RISE_M;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const groups: { start: number; count: number; material: number }[] = [];
  const quad = (a: number[], b: number[], c: number[], e: number[], n: number[], uv: number[][]): void => {
    const at = positions.length / 3;
    positions.push(...a, ...b, ...c, ...e);
    for (let i = 0; i < 4; i++) normals.push(...n);
    for (const u of uv) uvs.push(...u);
    indices.push(at, at + 1, at + 2, at, at + 2, at + 3);
  };
  const tri = (a: number[], b: number[], c: number[], n: number[]): void => {
    const at = positions.length / 3;
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) normals.push(...n);
    uvs.push(0, 0, 1, 0, 0.5, 1);
    indices.push(at, at + 1, at + 2);
  };
  const group = (material: number, body: () => void): void => {
    const start = indices.length;
    body();
    groups.push({ start, count: indices.length - start, material });
  };
  const faceUv = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  group(0, () => {
    quad([f, 0, -d], [-f, 0, -d], [-f, h, -d], [f, h, -d], [0, 0, -1], faceUv);
    quad([-f, 0, d], [f, 0, d], [f, h, d], [-f, h, d], [0, 0, 1], faceUv);
  });
  group(1, () => {
    quad([f, 0, d], [f, 0, -d], [f, h, -d], [f, h, d], [1, 0, 0], faceUv);
    quad([-f, 0, -d], [-f, 0, d], [-f, h, d], [-f, h, -d], [-1, 0, 0], faceUv);
    tri([f, h, -d], [f, h, d], [f, h + r, 0], [1, 0, 0]);
    tri([-f, h, d], [-f, h, -d], [-f, h + r, 0], [-1, 0, 0]);
  });
  group(2, () => {
    const len = Math.hypot(d, r);
    quad([f, h, -d], [-f, h, -d], [-f, h + r, 0], [f, h + r, 0], [0, d / len, -r / len], faceUv);
    quad([-f, h, d], [f, h, d], [f, h + r, 0], [-f, h + r, 0], [0, d / len, r / len], faceUv);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  for (const g of groups) geometry.addGroup(g.start, g.count, g.material);
  return geometry;
}

/** One tree: a trunk and a cone of leaves, 7.5 m tall, scaled by the instance. Groups: 0 the trunk, 1 the leaves. */
function treeGeometry(): BufferGeometry {
  const trunk = 2.5;
  const canopy = new ConeGeometry(2.4, 5, 7);
  canopy.translate(0, trunk + 2.5, 0);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const t = 0.25;
  const box = [
    [[t, 0, -t], [-t, 0, -t], [-t, trunk, -t], [t, trunk, -t], [0, 0, -1]],
    [[-t, 0, t], [t, 0, t], [t, trunk, t], [-t, trunk, t], [0, 0, 1]],
    [[t, 0, t], [t, 0, -t], [t, trunk, -t], [t, trunk, t], [1, 0, 0]],
    [[-t, 0, -t], [-t, 0, t], [-t, trunk, t], [-t, trunk, -t], [-1, 0, 0]],
  ];
  for (const [a, b, c, e, n] of box) {
    const at = positions.length / 3;
    positions.push(...(a as number[]), ...(b as number[]), ...(c as number[]), ...(e as number[]));
    for (let i = 0; i < 4; i++) normals.push(...(n as number[]));
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(at, at + 1, at + 2, at, at + 2, at + 3);
  }
  const trunkCount = indices.length;
  const cp = canopy.getAttribute('position');
  const cn = canopy.getAttribute('normal');
  const base = positions.length / 3;
  for (let i = 0; i < cp.count; i++) {
    positions.push(cp.getX(i), cp.getY(i), cp.getZ(i));
    normals.push(cn.getX(i), cn.getY(i), cn.getZ(i));
    uvs.push(0, 0);
  }
  const ci = canopy.getIndex();
  if (ci) for (let i = 0; i < ci.count; i++) indices.push(base + ci.getX(i));
  canopy.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.addGroup(0, trunkCount, 0);
  geometry.addGroup(trunkCount, indices.length - trunkCount, 1);
  return geometry;
}

/**
 * A paving painted procedurally: a base colour with seeded grain, and for some kinds a pattern (paver joints, a
 * crossing's stripes), repeated every so many metres over the prisms' metre UVs (ADR-0024 Decision 3 keeps street
 * surfaces procedural).
 */
interface PavingSpec {
  readonly base: string;
  readonly grain: number;
  readonly pattern?: 'pavers' | 'stripes' | 'gravel' | 'lines';
  readonly metres: number;
  readonly roughness: number;
}
const PAVINGS: Readonly<Record<SurfaceKind | 'grass' | 'soil' | 'fields' | 'yard', PavingSpec>> = {
  fields: { base: '#4C9A4A', grain: 10, pattern: 'lines', metres: 32, roughness: 1 },
  yard: { base: '#A9A59C', grain: 8, metres: 6, roughness: 0.95 },
  asphalt: { base: '#4B4F52', grain: 14, metres: 6, roughness: 0.95 },
  sidewalk: { base: '#B9B4A8', grain: 8, pattern: 'pavers', metres: 2, roughness: 0.9 },
  kerb: { base: '#D6D2C8', grain: 4, metres: 2, roughness: 0.8 },
  crossing: { base: '#4B4F52', grain: 6, pattern: 'stripes', metres: 4, roughness: 0.9 },
  lane: { base: '#4F8A5B', grain: 8, metres: 3, roughness: 0.9 },
  parkpath: { base: '#B8A98C', grain: 16, pattern: 'gravel', metres: 2, roughness: 1 },
  plaza: { base: '#CFC9BB', grain: 6, pattern: 'pavers', metres: 3, roughness: 0.85 },
  grass: { base: '#6E9A58', grain: 18, pattern: 'gravel', metres: 8, roughness: 1 },
  soil: { base: '#A8906A', grain: 14, metres: 6, roughness: 1 },
};

/** A seeded stream for painting, the same picture every load. */
function paintRandom(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** Paint a paving into a repeating texture. */
function paintPaving(kind: SurfaceKind | 'grass' | 'soil' | 'fields' | 'yard'): CanvasTexture {
  const spec = PAVINGS[kind];
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);
    const next = paintRandom(kind.length * 7919 + 17);
    const base = new Color(spec.base);
    for (let i = 0; i < 2600; i++) {
      const v = (next() - 0.5) * spec.grain * 2;
      const c = new Color(base.r + v / 255, base.g + v / 255, base.b + v / 255);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(Math.floor(next() * size), Math.floor(next() * size), 2, 2);
    }
    if (spec.pattern === 'pavers') {
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i * size) / 4);
        ctx.lineTo(size, (i * size) / 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo((i * size) / 4, 0);
        ctx.lineTo((i * size) / 4, size);
        ctx.stroke();
      }
    } else if (spec.pattern === 'stripes') {
      ctx.fillStyle = 'rgba(245,245,240,0.9)';
      for (let i = 0; i < 4; i++) ctx.fillRect(0, (i * size) / 4 + size / 16, size, size / 8);
    } else if (spec.pattern === 'lines') {
      // A pitch's white lines: the touchline round the edge and the halfway line.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(6, 6, size - 12, size - 12);
      ctx.beginPath();
      ctx.moveTo(size / 2, 6);
      ctx.lineTo(size / 2, size - 6);
      ctx.stroke();
    } else if (spec.pattern === 'gravel') {
      for (let i = 0; i < 400; i++) {
        const v = next() * 40 - 20;
        const c = new Color(base.r + v / 255, base.g + v / 255, base.b + v / 255);
        ctx.fillStyle = `#${c.getHexString()}`;
        ctx.fillRect(Math.floor(next() * size), Math.floor(next() * size), 3, 3);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / spec.metres, 1 / spec.metres);
  texture.anisotropy = 4;
  return texture;
}

/** The kinds painted as pavings rather than plain colours. */
const PAVED: ReadonlySet<string> = new Set(Object.keys(PAVINGS));

/** Plain colours for the materials that are not facades. */
const PLAIN: Readonly<Record<Exclude<MaterialId, 'massing' | 'office' | 'plant' | 'fields' | 'yard' | SurfaceKind>, { color: string; roughness: number }>> = {
  strip: { color: '#4A5250', roughness: 0.95 },
  survey: { color: '#C98A2E', roughness: 0.9 },
  scaffold: { color: '#B9772A', roughness: 0.9 },
  crane: { color: '#E0B228', roughness: 0.6 },
  park: { color: '#6E9A58', roughness: 1 },
  path: { color: '#B8A98C', roughness: 1 },
  guideway: { color: '#34495A', roughness: 0.55 },
  closed: { color: '#B3261E', roughness: 0.7 },
  warned: { color: '#E5AE45', roughness: 0.7 },
  ordered: { color: '#C98A2E', roughness: 0.9 },
  stop: { color: '#E8E2D4', roughness: 0.8 },
  entry: { color: '#8C97A0', roughness: 0.8 },
  walkway: { color: '#A9B4BC', roughness: 0.95 },
  pipe: { color: '#7A6652', roughness: 0.6 },
};

/** A mover's body by class, metres: length along its heading, width, height (the Ledger's bodies, a height Mine);
 * the kit model that stands for it when loaded, else a box of its colour. */
const MOVER_BODY: Readonly<Record<MoverClass, { l: number; w: number; h: number; color: string; model: ModelId }>> = {
  pod: { l: 2.41, w: 1.39, h: 1.55, color: '#F2F0E8', model: 'pod' },
  cab: { l: 3.63, w: 1.9, h: 1.7, color: '#2E3A46', model: 'cab' },
  shuttle: { l: 4.75, w: 2.11, h: 2.6, color: '#3F7FBF', model: 'shuttle' },
};

/** Surface traffic's bodies: length, height, colour, and the kit model (plan Phase 5). */
const TRAFFIC_BODY: Readonly<Record<TrafficClass, { l: number; w: number; h: number; color: string; model: ModelId }>> = {
  bike: { l: 1.8, w: 0.6, h: 1.1, color: '#C8402A', model: 'bike' },
  cart: { l: 3.25, w: 1.5, h: 1.6, color: '#E0B228', model: 'cart' },
};

/** A kit vehicle's forward is its native +z; a scene heading is atan2 in (x east, y south), so the turn about y that
 * points the body along the heading is the heading itself plus a quarter turn (Mine, checked by eye). */
const VEHICLE_YAW = Math.PI / 2;

/** The materials that stand on the sub level; everything else is the surface, ghosted when the sub level shows. */
const SUB_MATERIALS: ReadonlySet<string> = new Set(['guideway', 'closed', 'warned', 'ordered', 'stop', 'entry', 'walkway', 'pipe']);

/** How faint the surface goes when the sub level shows: the ground, and the buildings and trees on it. */
const GHOST_GROUND = 0.3;
const GHOST_SURFACE = 0.12;

/** A packed kit model as loaded: one geometry and one material, ready to instance. */
interface LoadedModel {
  readonly geometry: BufferGeometry;
  readonly material: MeshStandardMaterial;
}

/** Where the packed models are served from, beside the page (ADR-0024 Decision 4). */
const MODELS_URL = 'assets/models/';

/** Metres from the orbit's target within which a tile's homes stand as kit models; beyond, the massing stands in
 * (a townhouse model is about 1,200 triangles against the box's 14; plan Phase 7 brings the full level of detail). */
export const MODELS_WITHIN_M = 600;

/** Where the view looks, so the kit models stand near it. */
export interface Focus {
  readonly x: number;
  readonly y: number;
}

/** How many neighborhoods take kit models however far the focus is from them, so something is always detailed. */
export const MODELS_NEAREST = 3;

/** The chunks whose homes stand as kit models: those within MODELS_WITHIN_M of the focus, and the MODELS_NEAREST
 * nearest whatever their distance; judged by where a chunk's homes centre. */
function nearChunks(chunks: readonly Chunk[], focus: Focus): Set<string> {
  const ranked = chunks
    .filter((c) => c.homes.length)
    .map((c) => {
      const cx = c.homes.reduce((t, x) => t + x.x, 0) / c.homes.length;
      const cy = c.homes.reduce((t, x) => t + x.y, 0) / c.homes.length;
      return { key: c.key, d: Math.hypot(cx - focus.x, cy - focus.y) };
    })
    .sort((a, b) => a.d - b.d);
  return new Set(ranked.filter((r, i) => i < MODELS_NEAREST || r.d <= MODELS_WITHIN_M).map((r) => r.key));
}

/** Lite: the one nearest neighborhood only. */
function nearChunksLite(chunks: readonly Chunk[], focus: Focus): Set<string> {
  const all = [...nearChunks(chunks, focus)];
  const nearest = chunks
    .filter((c) => c.homes.length && all.includes(c.key))
    .map((c) => ({ key: c.key, d: Math.hypot(c.homes.reduce((t, x) => t + x.x, 0) / c.homes.length - focus.x, c.homes.reduce((t, x) => t + x.y, 0) / c.homes.length - focus.y) }))
    .sort((a, b) => a.d - b.d)[0];
  return new Set(nearest ? [nearest.key] : []);
}

/** The key of the group a home belongs to: its size, its kit model when its tile is near enough, and its variant. */
function groupKey(h: HomeInstance, near: boolean): string {
  return `${h.frontM.toFixed(2)}x${h.depthM.toFixed(2)}x${h.heightM.toFixed(2)}|${near ? h.model : 'box'}|${h.variant}`;
}

/** A group of townhouse instances: one size, one model (or, until it loads, one facade variant), every chunk's homes of it in a slot of the mesh. */
interface HomeGroup {
  mesh: InstancedMesh | null;
  geometry: BufferGeometry | null;
  /** Each chunk's slot: where its homes start, how many, and the chunk's signature when they were written. */
  slots: Map<string, { start: number; count: number; signature: string }>;
  count: number;
  /** Whether the mesh stands on the loaded kit model (true) or the massing stand-in (false). */
  model: boolean;
}

/** The renderer on one canvas: built once, fed a described scene when it changes, rendered every frame. */
export class IrlRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new GlScene();
  private readonly camera = new PerspectiveCamera(45, 1, 1, 100000);
  private readonly sun: DirectionalLight;
  private readonly sky: HemisphereLight;
  private readonly ambient: AmbientLight;
  private ground: Mesh | null = null;
  private readonly chunks = new Map<string, { signature: string; meshes: Mesh[]; sub: Mesh[] }>();
  private readonly materials = new Map<string, MeshStandardMaterial>();
  private readonly homeGroups = new Map<string, HomeGroup>();
  private readonly treeGeometry = treeGeometry();
  private trees: InstancedMesh | null = null;
  private readonly movers = new Map<MoverClass, InstancedMesh>();
  private readonly props = new Map<ModelId, InstancedMesh>();
  private propsSignature = '';
  private readonly traffic = new Map<TrafficClass, InstancedMesh>();
  private readonly treeMeshes: InstancedMesh[] = [];
  private shore: Mesh[] = [];
  private readonly loader = new GLTFLoader();
  private readonly models = new Map<ModelId, LoadedModel | 'loading' | 'failed'>();
  private readonly onLoaded: () => void;
  private modelsPainted = 0;
  /** Counts the models that have arrived, so a build after an arrival lays the homes out again. */
  private modelsArrived = 0;
  private focus: Focus = { x: 0, y: 0 };
  private homesSignature = '';
  private treesSignature = '';
  private sun_: SunAt = sunAt(12);
  private sub = false;
  private readonly skyDome = new Sky();
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private lite = false;
  private lastMs = 0;
  private sunCenter: Point3 = { x: 0, y: 0, z: 0 };
  private sunRadius = 1000;
  private tokens: Tokens = { ground: '#E1E8DF', sky: '#CFE0EE' };
  private far = 20000;
  private frames = 0;

  /**
   * @param canvas - the page's canvas
   * @param onLost - called when the GL context is lost, so the page can say so
   * @param onRestored - called when it comes back, so the page can render again
   */
  constructor(canvas: HTMLCanvasElement, onLost: () => void, onRestored: () => void, onLoaded: () => void = () => undefined) {
    this.onLoaded = onLoaded;
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // The frame's counters are reset by hand so a composed frame's passes add up rather than the last one standing.
    this.renderer.info.autoReset = false;
    // Software GL (SwiftShader on the publish workflow's runner and in Playwright's headless shell, llvmpipe on a bare
    // Linux) cannot carry the composer or the full detail: it goes lite from the first frame rather than after the
    // first slow ones. A GPU's name never matches.
    if (softwareGl(this.renderer)) this.goLite();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.sun = new DirectionalLight(0xfff4e0, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.sky = new HemisphereLight(0xbfd8f0, 0x6b6a5a, 0.9);
    this.ambient = new AmbientLight(0xffffff, 0.15);
    this.scene.add(this.sun, this.sun.target, this.sky, this.ambient);
    // The physical sky: a dome far past the site, its sun set with the sun.
    this.skyDome.scale.setScalar(300000);
    const u = this.skyDome.material.uniforms;
    (u.turbidity as { value: number }).value = 6;
    (u.rayleigh as { value: number }).value = 1.6;
    (u.mieCoefficient as { value: number }).value = 0.004;
    (u.mieDirectionalG as { value: number }).value = 0.8;
    this.scene.add(this.skyDome);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      onLost();
    });
    canvas.addEventListener('webglcontextrestored', () => onRestored());
  }

  /** Frames rendered since the renderer was made. */
  get rendered(): number {
    return this.frames;
  }

  /** Distinct kit models standing in instanced meshes, as of the last build. */
  get kitModels(): number {
    return this.modelsPainted;
  }

  /**
   * A packed model, loaded once: its one mesh's geometry and material (the pack script joins a kit model to one),
   * the material patched for per-instance light. Until it arrives (or if it fails) null, and the caller stands the
   * massing in; when it arrives the page is told so it renders again.
   */
  private model(id: ModelId): LoadedModel | null {
    const had = this.models.get(id);
    if (had && had !== 'loading' && had !== 'failed') return had;
    if (had) return null;
    this.models.set(id, 'loading');
    this.loader.load(
      `${MODELS_URL}${id}.glb`,
      (gltf) => {
        let found: LoadedModel | null = null;
        // The pack quantizes positions to the unit range and puts the scale back on the node, so the node's world
        // transform is baked into the geometry: what is instanced is then in the kit's units, as the manifest measures.
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (found || !(o as Mesh).isMesh) return;
          const mesh = o as Mesh;
          const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const material = (source as MeshStandardMaterial).clone();
          material.emissive = new Color(WINDOW_LIGHT);
          material.emissiveIntensity = 0;
          litByAttribute(material);
          const geometry = mesh.geometry.clone();
          geometry.applyMatrix4(mesh.matrixWorld);
          if (this.sub && id !== 'pod' && id !== 'cab' && id !== 'shuttle') {
            material.transparent = true;
            material.opacity = GHOST_SURFACE;
            material.depthWrite = false;
          }
          found = { geometry, material };
        });
        this.models.set(id, found ?? 'failed');
        if (found) {
          this.modelsArrived++;
          this.onLoaded();
        }
      },
      undefined,
      (error) => {
        this.models.set(id, 'failed');
        console.warn(`The city IRL could not load the model ${id}:`, error);
      },
    );
    return null;
  }

  /** The material for a prism: plain colours, the facade sheets painted once, massing by vertex colour. */
  private material(id: MaterialId | 'grass' | 'soil'): MeshStandardMaterial {
    type Paved = SurfaceKind | 'grass' | 'soil' | 'fields' | 'yard';
    let m = this.materials.get(id);
    if (m) return m;
    if (id === 'massing') {
      m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, emissive: new Color(WINDOW_LIGHT), emissiveIntensity: 0 });
      litByAttribute(m);
    }
    else if (id === 'office') m = sheetMaterial(officeFacade());
    else if (id === 'plant') m = sheetMaterial(plantFacade());
    else if (PAVED.has(id)) m = new MeshStandardMaterial({ map: paintPaving(id as Paved), roughness: PAVINGS[id as Paved].roughness, metalness: 0 });
    else m = new MeshStandardMaterial({ color: new Color(PLAIN[id as keyof typeof PLAIN].color), roughness: PLAIN[id as keyof typeof PLAIN].roughness, metalness: 0 });
    if (id === 'stop' || id === 'closed' || id === 'warned') {
      m.emissive = new Color(id === 'stop' ? WINDOW_LIGHT : PLAIN[id as 'closed' | 'warned'].color);
      m.emissiveIntensity = 0.35;
    }
    this.materials.set(id, m);
    return m;
  }

  /** The three materials of a townhouse of a variant: the facade (lit per instance), the plain wall, the roof. */
  private homeMaterials(variant: HomeVariant): MeshStandardMaterial[] {
    const sheet = homeFacade(variant);
    const facadeKey = `home-${variant}`;
    let facade = this.materials.get(facadeKey);
    if (!facade) {
      facade = sheetMaterial(sheet, true);
      this.materials.set(facadeKey, facade);
    }
    const wallKey = `wall-${variant}`;
    let wall = this.materials.get(wallKey);
    if (!wall) {
      wall = new MeshStandardMaterial({ color: new Color(sheet.wall), roughness: 0.9, metalness: 0 });
      this.materials.set(wallKey, wall);
    }
    const roofKey = `roof-${variant}`;
    let roof = this.materials.get(roofKey);
    if (!roof) {
      roof = new MeshStandardMaterial({ color: new Color(sheet.roof), roughness: 0.95, metalness: 0 });
      this.materials.set(roofKey, roof);
    }
    return [facade, wall, roof];
  }

  /** Build a chunk's merged meshes, one a material; the sub level's are returned apart and shown on the toggle. */
  private chunkMeshes(chunk: Chunk, palette: Palette): { surface: Mesh[]; sub: Mesh[] } {
    const buckets = new Map<MaterialId, { positions: number[]; normals: number[]; uvs: number[]; colors: number[]; lit: number[]; indices: number[] }>();
    const tint = new Color();
    for (const { material, prism, kind, lit } of chunk.meshes) {
      let b = buckets.get(material);
      if (!b) {
        b = { positions: [], normals: [], uvs: [], colors: [], lit: [], indices: [] };
        buckets.set(material, b);
      }
      const at = b.positions.length / 3;
      for (let i = 0; i < prism.positions.length; i += 3) {
        b.positions.push(prism.positions[i] as number, prism.positions[i + 2] as number, -(prism.positions[i + 1] as number));
        b.normals.push(prism.normals[i] as number, prism.normals[i + 2] as number, -(prism.normals[i + 1] as number));
      }
      for (let i = 0; i < prism.uvs.length; i++) b.uvs.push(prism.uvs[i] as number);
      if (material === 'massing') {
        tint.set(palette[kind]).multiplyScalar(DARK + (1 - DARK) * lit);
        // By night a far block glows by its occupied share: homes by their people, a ring by its offices, a plant a little.
        const glow = kind === 'hood' ? lit : kind === 'ring' ? 0.6 : kind === 'school' ? 0.3 : kind === 'line' || kind === 'site' || kind === 'siteline' || kind === 'fields' ? 0 : 0.25;
        for (let i = 0; i < prism.positions.length; i += 3) {
          b.colors.push(tint.r, tint.g, tint.b);
          b.lit.push(glow);
        }
      }
      for (const ix of prism.indices) b.indices.push(at + ix);
    }
    const out = { surface: [] as Mesh[], sub: [] as Mesh[] };
    for (const [material, b] of buckets) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(b.positions), 3));
      geometry.setAttribute('normal', new BufferAttribute(new Float32Array(b.normals), 3));
      geometry.setAttribute('uv', new BufferAttribute(new Float32Array(b.uvs), 2));
      if (b.colors.length) {
        geometry.setAttribute('color', new BufferAttribute(new Float32Array(b.colors), 3));
        geometry.setAttribute('aLit', new BufferAttribute(new Float32Array(b.lit), 1));
      }
      geometry.setIndex(b.indices);
      const mesh = new Mesh(geometry, this.material(material));
      const flat = material === 'strip' || material === 'survey' || material === 'park' || material === 'path' || material === 'fields' || material === 'yard' || PAVED.has(material);
      const sub = SUB_MATERIALS.has(material);
      mesh.castShadow = !flat && !sub;
      mesh.receiveShadow = !sub;
      if (sub) {
        mesh.visible = this.sub;
        out.sub.push(mesh);
      } else out.surface.push(mesh);
    }
    return out;
  }

  /**
   * Bring the townhouse instances up to the chunks: one instanced mesh a size and variant, each chunk's homes in a
   * slot of it. When every chunk keeps its count, only the slots of the chunks that changed are written again (a
   * month moving people rewrites that tile's shade and light); when a chunk's count changes (a tile built or
   * cleared), that group is laid out afresh.
   */
  private buildHomes(chunks: readonly Chunk[]): void {
    // What each group should hold, chunk by chunk in key order; a chunk near the focus takes kit models.
    const wanted = new Map<string, { chunk: Chunk; homes: HomeInstance[] }[]>();
    const nearSet = this.lite ? nearChunksLite(chunks, this.focus) : nearChunks(chunks, this.focus);
    for (const chunk of [...chunks].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
      const byGroup = new Map<string, HomeInstance[]>();
      const near = nearSet.has(chunk.key);
      for (const h of chunk.homes) {
        const k = groupKey(h, near);
        const list = byGroup.get(k);
        if (list) list.push(h);
        else byGroup.set(k, [h]);
      }
      for (const [k, homes] of byGroup) {
        const list = wanted.get(k);
        if (list) list.push({ chunk, homes });
        else wanted.set(k, [{ chunk, homes }]);
      }
    }
    for (const [key, g] of this.homeGroups) {
      if (wanted.has(key)) continue;
      if (g.mesh) {
        this.scene.remove(g.mesh);
        g.mesh.dispose();
      }
      g.geometry?.dispose();
      this.homeGroups.delete(key);
    }
    const dummy = new Object3D();
    const tint = new Color();
    for (const [key, parts] of wanted) {
      const first = parts[0]?.homes[0] as HomeInstance;
      let group = this.homeGroups.get(key);
      if (!group) {
        group = { mesh: null, geometry: null, slots: new Map(), count: 0, model: false };
        this.homeGroups.set(key, group);
      }
      const loaded = key.split('|')[1] === 'box' ? null : this.model(first.model);
      const total = parts.reduce((t, p) => t + p.homes.length, 0);
      const sameLayout =
        group.mesh !== null &&
        group.model === (loaded !== null) &&
        group.count === total &&
        parts.length === group.slots.size &&
        parts.every((p, i) => {
          const slot = group?.slots.get(p.chunk.key);
          return slot !== undefined && slot.count === p.homes.length && slot.start === parts.slice(0, i).reduce((t, q) => t + q.homes.length, 0);
        });
      if (!sameLayout) {
        if (group.mesh) {
          this.scene.remove(group.mesh);
          group.mesh.dispose();
        }
        if (!group.model) group.geometry?.dispose();
        // The kit model when it has loaded (its geometry shared, so a clone carries this group's light attribute);
        // the massing stand-in until then.
        group.model = loaded !== null;
        group.geometry = loaded ? loaded.geometry.clone() : homeGeometry(first.frontM, first.depthM, first.heightM);
        group.geometry.setAttribute('aLit', new InstancedBufferAttribute(new Float32Array(total), 1));
        group.mesh = new InstancedMesh(group.geometry, loaded ? loaded.material : this.homeMaterials(first.variant), total);
        group.mesh.castShadow = true;
        group.mesh.receiveShadow = true;
        this.scene.add(group.mesh);
        group.slots.clear();
        group.count = total;
      }
      const mesh = group.mesh as InstancedMesh;
      const lit = group.geometry?.getAttribute('aLit') as InstancedBufferAttribute;
      // A kit model is placed by its fit: scaled to the front, floor on the ground, front face at the street edge.
      const fit: Fit | null = loaded ? fitToFront(first.model, first.frontM, first.depthM) : null;
      let start = 0;
      let touched = false;
      for (const { chunk, homes } of parts) {
        const slot = group.slots.get(chunk.key);
        if (!slot || slot.signature !== chunk.signature) {
          homes.forEach((h, i) => {
            const at = start + i;
            dummy.position.copy(toGl({ x: h.x, y: h.y, z: 0 }));
            dummy.rotation.set(0, h.yaw, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            if (fit) {
              // In the home's own frame: the fit's offset, then its scale.
              const local = new Matrix4().makeTranslation(fit.offset.x, fit.offset.y, fit.offset.z).multiply(new Matrix4().makeScale(fit.scale, fit.scale, fit.scale));
              dummy.matrix.multiply(local);
            }
            mesh.setMatrixAt(at, dummy.matrix);
            // A little variety in the wall's shade, the same for the same home; an empty home a shade greyer.
            const shade = (0.9 + (0.12 * ((((h.x * 7 + h.y * 13) % 11) + 11) % 11)) / 10) * (h.lit ? 1 : 0.85);
            mesh.setColorAt(at, tint.setScalar(shade));
            lit.setX(at, h.lit);
          });
          group.slots.set(chunk.key, { start, count: homes.length, signature: chunk.signature });
          touched = true;
        }
        start += homes.length;
      }
      if (touched) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        lit.needsUpdate = true;
      }
    }
  }

  /**
   * Rebuild the props (lamps, planters) from every chunk's: one instanced mesh a kit model, each placed by its height
   * fit; a model not yet loaded leaves its props out until it arrives.
   */
  private buildProps(chunks: readonly Chunk[], nearSet: ReadonlySet<string>): void {
    const byModel = new Map<ModelId, PropInstance[]>();
    for (const c of chunks) {
      const near = nearSet.has(c.key);
      for (const p of c.props) {
        if (p.bulk && !near) continue;
        const list = byModel.get(p.model);
        if (list) list.push(p);
        else byModel.set(p.model, [p]);
      }
    }
    for (const [id, mesh] of this.props) {
      if (byModel.has(id)) continue;
      this.scene.remove(mesh);
      mesh.dispose();
      this.props.delete(id);
    }
    const dummy = new Object3D();
    for (const [id, list] of byModel) {
      // A hedge is a box, not the kit's fence: a thousand a neighborhood at twelve triangles instead of 180.
      const loaded = id === 'hedge' ? this.hedge() : this.model(id);
      const had = this.props.get(id);
      if (had) {
        this.scene.remove(had);
        had.dispose();
        this.props.delete(id);
      }
      if (!loaded) continue;
      const mesh = new InstancedMesh(loaded.geometry, loaded.material, list.length);
      list.forEach((p, i) => {
        const fit: Fit = id === 'hedge' ? { scale: p.heightM / 1.2, offset: { x: 0, y: 0, z: 0 } } : p.footprintM ? fitToFootprint(id, p.footprintM) : fitToHeight(id, p.heightM);
        dummy.position.copy(toGl({ x: p.x, y: p.y, z: 0 }));
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        dummy.matrix.multiply(new Matrix4().makeTranslation(fit.offset.x, fit.offset.y, fit.offset.z).multiply(new Matrix4().makeScale(fit.scale, fit.scale, fit.scale)));
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.props.set(id, mesh);
    }
  }

  private hedgeModel: LoadedModel | null = null;

  /** The hedge: a dark green box 6 m long, 0.8 m deep and 1.2 m high, fitted by height like any prop. */
  private hedge(): LoadedModel {
    if (this.hedgeModel) return this.hedgeModel;
    const geometry = new BoxGeometry(6, 1.2, 0.8);
    geometry.translate(0, 0.6, 0);
    const material = new MeshStandardMaterial({ color: new Color('#2F6B33'), roughness: 1, metalness: 0 });
    this.materials.set('hedge-box', material);
    this.hedgeModel = { geometry, material };
    return this.hedgeModel;
  }

  /** Rebuild the trees from every chunk's: one instanced mesh a species on the kit's models, or the cone until a
   * species' model arrives. */
  private buildTrees(chunks: readonly Chunk[]): void {
    const trees: Tree[] = [];
    for (const c of chunks) trees.push(...c.trees);
    if (this.trees) {
      this.scene.remove(this.trees);
      this.trees.dispose();
      this.trees = null;
    }
    for (const m of this.treeMeshes) {
      this.scene.remove(m);
      m.dispose();
    }
    this.treeMeshes.length = 0;
    if (!trees.length) return;
    const dummyTree = new Object3D();
    const left: Tree[] = [];
    for (const species of ['tree-small', 'tree-large'] as const) {
      const mine = trees.filter((t) => t.species === species);
      if (!mine.length) continue;
      const loaded = this.model(species);
      if (!loaded) {
        left.push(...mine);
        continue;
      }
      const mesh = new InstancedMesh(loaded.geometry, loaded.material, mine.length);
      mine.forEach((t, i) => {
        const fit = fitToHeight(species, t.heightM);
        dummyTree.position.copy(toGl({ x: t.x, y: t.y, z: 0 }));
        dummyTree.rotation.set(0, (t.x + t.y) % 6.28, 0);
        dummyTree.scale.set(1, 1, 1);
        dummyTree.updateMatrix();
        dummyTree.matrix.multiply(new Matrix4().makeTranslation(fit.offset.x, fit.offset.y, fit.offset.z).multiply(new Matrix4().makeScale(fit.scale, fit.scale, fit.scale)));
        mesh.setMatrixAt(i, dummyTree.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.treeMeshes.push(mesh);
    }
    if (!left.length) return;
    trees.length = 0;
    trees.push(...left);
    const trunk = this.material('path');
    const leafKey = 'leaves';
    let leaves = this.materials.get(leafKey);
    if (!leaves) {
      leaves = new MeshStandardMaterial({ color: new Color('#3F7A3A'), roughness: 1, metalness: 0 });
      this.materials.set(leafKey, leaves);
    }
    const mesh = new InstancedMesh(this.treeGeometry, [trunk, leaves], trees.length);
    const dummy = new Object3D();
    const tint = new Color();
    trees.forEach((t, i) => {
      dummy.position.copy(toGl({ x: t.x, y: t.y, z: 0 }));
      const s = t.heightM / 7.5;
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, (t.x + t.y) % 6.28, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint.setScalar(0.85 + 0.3 * ((((t.x * 3 + t.y * 5) % 7) + 7) % 7) / 7));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.trees = mesh;
  }

  /**
   * Bring what stands up to the described scene: every chunk whose signature changed is built again (its merged
   * meshes replaced), the townhouse and tree instances are rebuilt when any chunk's changed, the ground plane and
   * the sun's shadow camera are fitted to the box, and the sky, fog and lights follow the tokens and the time of day.
   * @returns what was rebuilt
   */
  build(described: Described, palette: Palette, tokens: Tokens, focus?: Focus): BuildStats {
    this.tokens = tokens;
    if (focus) this.focus = focus;
    const keep = new Set(described.chunks.map((c) => c.key));
    for (const [key, c] of this.chunks) {
      if (keep.has(key)) continue;
      for (const m of [...c.meshes, ...c.sub]) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
      this.chunks.delete(key);
    }
    let rebuilt = 0;
    for (const chunk of described.chunks) {
      const had = this.chunks.get(chunk.key);
      if (had && had.signature === chunk.signature) continue;
      if (had) {
        for (const m of [...had.meshes, ...had.sub]) {
          this.scene.remove(m);
          m.geometry.dispose();
        }
      }
      const built = this.chunkMeshes(chunk, palette);
      for (const m of [...built.surface, ...built.sub]) this.scene.add(m);
      this.chunks.set(chunk.key, { signature: chunk.signature, meshes: built.surface, sub: built.sub });
      rebuilt++;
    }
    const nearSet = this.lite ? nearChunksLite(described.chunks, this.focus) : nearChunks(described.chunks, this.focus);
    const homesSignature = `${this.modelsArrived}|${this.lite ? 'lite' : 'full'}|${described.chunks
      .filter((c) => c.homes.length)
      .map((c) => `${c.key}:${c.signature}:${nearSet.has(c.key) ? 'kit' : 'box'}`)
      .join(';')}`;
    if (homesSignature !== this.homesSignature) {
      this.buildHomes(described.chunks);
      this.homesSignature = homesSignature;
    }
    const treesSignature = `${this.modelsArrived}|${described.chunks
      .filter((c) => c.trees.length)
      .map((c) => c.key)
      .join(';')}`;
    if (treesSignature !== this.treesSignature) {
      this.buildTrees(described.chunks);
      this.treesSignature = treesSignature;
    }
    const propsSignature = `${this.modelsArrived}|${this.lite ? 'lite' : 'full'}|${described.chunks
      .filter((c) => c.props.length)
      .map((c) => `${c.key}:${c.props.length}:${nearSet.has(c.key) ? 'near' : 'far'}`)
      .join(';')}`;
    if (propsSignature !== this.propsSignature) {
      // Lite skips the bulk vegetation altogether.
      this.buildProps(described.chunks, this.lite ? new Set<string>() : nearSet);
      this.propsSignature = propsSignature;
    }
    this.fitGround(described, tokens);
    this.applyLight();
    this.applySub();
    let homes = 0;
    const standing = new Set<string>();
    for (const [key, g] of this.homeGroups) {
      homes += g.count;
      if (g.model && g.mesh) standing.add(key.split('|')[1] ?? key);
    }
    this.modelsPainted = standing.size;
    return { rebuilt, chunks: this.chunks.size, homes, trees: this.trees?.count ?? 0 };
  }

  /** The ground plane and the sun fitted to the scene's box. */
  private fitGround(described: Described, tokens: Tokens): void {
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      (this.ground.material as MeshStandardMaterial).dispose();
      this.ground = null;
    }
    for (const m of this.shore) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.shore = [];
    const bounds = described.bounds;
    if (!bounds) return;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    const margin = Math.max(spanX, spanY) * 0.6 + 200;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const terrain = described.terrain;
    // The land: grass to the shore (ADR-0024 Decision 3), then a strip of soil, then water off the south edge; without
    // a terrain (no context) a plain plane in the page's ground colour.
    const land = terrain ? { x0: Math.min(terrain.west, cx - margin), x1: Math.max(terrain.east, cx + margin), y0: Math.min(terrain.north, cy - margin), y1: terrain.shoreY - SHORE_SOIL_M } : { x0: cx - spanX / 2 - margin, x1: cx + spanX / 2 + margin, y0: cy - spanY / 2 - margin, y1: cy + spanY / 2 + margin };
    const slab = (x0: number, x1: number, y0: number, y1: number, material: MeshStandardMaterial, z: number): Mesh => {
      const plane = new PlaneGeometry(x1 - x0, y1 - y0);
      plane.rotateX(-Math.PI / 2);
      // Metre UVs so a paving repeats by its own size.
      const uv = plane.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (y1 - y0));
      const mesh = new Mesh(plane, material);
      mesh.position.copy(toGl({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z }));
      mesh.receiveShadow = true;
      return mesh;
    };
    this.ground = slab(land.x0, land.x1, land.y0, land.y1, terrain ? this.material('grass' as MaterialId) : new MeshStandardMaterial({ color: new Color(tokens.ground), roughness: 1, metalness: 0 }), 0);
    this.scene.add(this.ground);
    if (terrain) {
      const soil = slab(land.x0, land.x1, terrain.shoreY - SHORE_SOIL_M, terrain.shoreY, this.material('soil' as MaterialId), -0.05);
      const waterKey = 'water';
      let water = this.materials.get(waterKey);
      if (!water) {
        water = new MeshStandardMaterial({ color: new Color('#2F6F9E'), roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
        this.materials.set(waterKey, water);
      }
      const lake = slab(land.x0, land.x1, terrain.shoreY, terrain.shoreY + 4000, water, -0.4);
      this.shore = [soil, lake];
      this.scene.add(soil, lake);
    }
    const radius = Math.hypot(spanX, spanY, bounds.maxZ) / 2 + 50;
    this.sunCenter = { x: cx, y: cy, z: 0 };
    this.sunRadius = radius;
    this.sun.target.position.copy(toGl({ x: cx, y: cy, z: 0 }));
    this.placeSun();
    const shadow = this.sun.shadow.camera;
    shadow.left = -radius;
    shadow.right = radius;
    shadow.top = radius;
    shadow.bottom = -radius;
    shadow.near = radius;
    shadow.far = radius * 6;
    shadow.updateProjectionMatrix();
    this.far = Math.max(spanX, spanY) * 6 + 2000;
  }

  /**
   * The fleet placed for this frame: one instanced mesh a class, remade when a class's count changes, each mover a
   * box on the guideway's top turned to its heading. Movers ride the sub level, so they show with it.
   */
  setMovers(placed: Readonly<Record<MoverClass, readonly Placed[]>>): void {
    const dummy = new Object3D();
    for (const cls of ['pod', 'cab', 'shuttle'] as const) {
      const list = placed[cls];
      let mesh = this.movers.get(cls);
      if (mesh && mesh.count !== list.length) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.dispose();
        mesh = undefined;
        this.movers.delete(cls);
      }
      if (!list.length) continue;
      const body = MOVER_BODY[cls];
      const loaded = this.model(body.model);
      const wantKit = loaded !== null;
      if (mesh && (mesh.userData.kit === true) !== wantKit) {
        this.scene.remove(mesh);
        if (!mesh.userData.kit) mesh.geometry.dispose();
        mesh.dispose();
        mesh = undefined;
        this.movers.delete(cls);
      }
      if (!mesh) {
        const key = `mover-${cls}`;
        let material = this.materials.get(key);
        if (!material) {
          material = new MeshStandardMaterial({ color: new Color(body.color), roughness: 0.4, metalness: 0.2, emissive: new Color(WINDOW_LIGHT), emissiveIntensity: 0.25 });
          this.materials.set(key, material);
        }
        let geometry: BufferGeometry;
        if (loaded) geometry = loaded.geometry;
        else {
          geometry = new BoxGeometry(body.l, body.h, body.w);
          geometry.translate(0, body.h / 2, 0);
        }
        mesh = new InstancedMesh(geometry, loaded ? loaded.material : material, list.length);
        mesh.userData.kit = wantKit;
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.movers.set(cls, mesh);
      }
      const fit = loaded ? fitToFootprint(body.model, body.l) : null;
      list.forEach((p, i) => {
        dummy.position.copy(toGl({ x: p.x, y: p.y, z: SUB_DEPTH_M + 1 }));
        // Scene heading is atan2 in (x east, y south); the box's length lies along x, the kit body's along its z.
        dummy.rotation.set(0, p.heading + (fit ? VEHICLE_YAW : 0), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        if (fit) dummy.matrix.multiply(new Matrix4().makeTranslation(fit.offset.x, fit.offset.y, fit.offset.z).multiply(new Matrix4().makeScale(fit.scale, fit.scale, fit.scale)));
        (mesh as InstancedMesh).setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * The surface traffic placed for this frame: one instanced mesh a class on the kit's body (a box until it arrives),
   * each on the ground turned to its heading.
   */
  setTraffic(placed: Readonly<Record<TrafficClass, readonly TrafficPlaced[]>>): void {
    const dummy = new Object3D();
    for (const cls of ['bike', 'cart'] as const) {
      const list = placed[cls];
      const body = TRAFFIC_BODY[cls];
      const loaded = this.model(body.model);
      let mesh = this.traffic.get(cls);
      if (mesh && (mesh.count !== list.length || (mesh.userData.kit === true) !== (loaded !== null))) {
        this.scene.remove(mesh);
        if (!mesh.userData.kit) mesh.geometry.dispose();
        mesh.dispose();
        mesh = undefined;
        this.traffic.delete(cls);
      }
      if (!list.length) continue;
      if (!mesh) {
        const key = `traffic-${cls}`;
        let material = this.materials.get(key);
        if (!material) {
          material = new MeshStandardMaterial({ color: new Color(body.color), roughness: 0.5, metalness: 0.1 });
          this.materials.set(key, material);
        }
        let geometry: BufferGeometry;
        if (loaded) geometry = loaded.geometry;
        else {
          geometry = new BoxGeometry(body.l, body.h, body.w);
          geometry.translate(0, body.h / 2, 0);
        }
        mesh = new InstancedMesh(geometry, loaded ? loaded.material : material, list.length);
        mesh.userData.kit = loaded !== null;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.traffic.set(cls, mesh);
      }
      const fit = loaded ? fitToFootprint(body.model, body.l) : null;
      list.forEach((p, i) => {
        dummy.position.copy(toGl({ x: p.x, y: p.y, z: 0.1 }));
        dummy.rotation.set(0, p.heading + (fit ? VEHICLE_YAW : 0), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        if (fit) dummy.matrix.multiply(new Matrix4().makeTranslation(fit.offset.x, fit.offset.y, fit.offset.z).multiply(new Matrix4().makeScale(fit.scale, fit.scale, fit.scale)));
        (mesh as InstancedMesh).setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** The sub level shown or hidden: shown, the ground fades, the surface ghosts, and the guideway, stops and entries appear. */
  setSub(on: boolean): void {
    if (on === this.sub) return;
    this.sub = on;
    this.applySub();
  }

  private applySub(): void {
    const on = this.sub;
    for (const c of this.chunks.values()) for (const m of c.sub) m.visible = on;
    const ghost = (m: MeshStandardMaterial, opacity: number): void => {
      m.transparent = on;
      m.opacity = on ? opacity : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    };
    for (const [key, m] of this.materials) if (!SUB_MATERIALS.has(key) && !key.startsWith('mover-')) ghost(m, GHOST_SURFACE);
    // The kit models' materials live with the models; a vehicle's (the fleet rides the sub level) stays as it is.
    for (const [id, loaded] of this.models) {
      if (loaded === 'loading' || loaded === 'failed') continue;
      if (id === 'pod' || id === 'cab' || id === 'shuttle') continue;
      ghost(loaded.material, GHOST_SURFACE);
    }
    for (const m of this.traffic.values()) m.visible = !on;
    if (this.ground) ghost(this.ground.material as MeshStandardMaterial, GHOST_GROUND);
    for (const m of this.shore) ghost(m.material as MeshStandardMaterial, GHOST_GROUND);
    this.sun.castShadow = !on;
  }

  /** The time of day, coarsely: noon or night; the fine control is `setSun`. */
  setLight(light: Light): void {
    this.setSun(sunAt(light === 'night' ? 23 : 12));
  }

  /**
   * The sun set from the sun module's reading (ADR-0024 Decision 5): the sky dome's sun, the directional light's
   * place, colour and strength, the hemisphere and ambient light, the fog's tint, and the lights that come on as
   * daylight fades: the windows of the lived-in homes, the offices, the lamps.
   */
  setSun(sun: SunAt): void {
    this.sun_ = sun;
    this.applyLight();
  }

  /** The sun's direction as the renderer reads it. */
  get sunReading(): SunAt {
    return this.sun_;
  }

  /** Put the directional light where the sun is, far enough out that its shadow camera holds the site; under the
   * horizon the light comes from a dim moon opposite. */
  private placeSun(): void {
    const d = this.sun_.direction;
    const up = this.sun_.elevation > 0.02;
    const dir = up ? d : { x: -d.x, y: -d.y, z: Math.max(0.35, -d.z) };
    const r = this.sunRadius * 2;
    this.sun.position.copy(toGl({ x: this.sunCenter.x + dir.x * r, y: this.sunCenter.y + dir.y * r, z: dir.z * r }));
  }

  private applyLight(): void {
    const sun = this.sun_;
    const day = sun.daylight;
    const night = 1 - day;
    // How low the sun is while up: warms its light toward orange and the fog toward dusk.
    const low = sun.elevation > 0 ? 1 - Math.min(1, sun.elevation / 0.5) : 1;
    const daySky = new Color(this.tokens.sky);
    const duskSky = new Color('#E8A66B');
    const nightSky = new Color('#0C1322');
    const tint = daySky.clone().lerp(duskSky, low * day * 0.7).lerp(nightSky, night);
    this.scene.fog = new Fog(tint, this.far * 0.35, this.far);
    const u = this.skyDome.material.uniforms;
    (u.sunPosition as { value: Vector3 }).value.copy(toGl({ x: sun.direction.x, y: sun.direction.y, z: sun.direction.z }));
    // Well under the horizon the dome is black; a deep night blue stands in for it.
    const deepNight = sun.elevation < (-4 * Math.PI) / 180;
    this.skyDome.visible = !deepNight;
    this.scene.background = deepNight ? nightSky.clone().lerp(new Color('#1A2640'), 0.5) : null;
    this.placeSun();
    this.sun.intensity = 0.4 + 2.6 * day;
    this.sun.color.set(new Color('#FFF4E0').lerp(new Color('#FFA85C'), low * day).lerp(new Color('#8FA6D6'), night));
    this.sky.intensity = 0.3 + 0.6 * day;
    this.sky.color.copy(tint).lerp(new Color('#FFFFFF'), 0.3 * day);
    this.sky.groundColor.set(new Color(this.tokens.ground).lerp(new Color('#0A0D10'), night));
    this.ambient.intensity = 0.06 + 0.1 * day;
    this.renderer.toneMappingExposure = 0.55 + 0.25 * day;
    if (this.bloom) {
      this.bloom.strength = 0.05 + 0.45 * night;
      this.bloom.threshold = 1.2 - 0.5 * night;
    }
    const glow = Math.max(0, 1 - day * 1.6);
    for (const [key, m] of this.materials) {
      if (key.startsWith('home-')) m.emissiveIntensity = 1.6 * glow;
      else if (key === 'massing') m.emissiveIntensity = 0.25 * glow;
      else if (key === 'office') m.emissiveIntensity = 1.0 * glow;
      else if (key === 'plant') m.emissiveIntensity = 0.6 * glow;
    }
    for (const [id, loaded] of this.models) {
      if (loaded === 'loading' || loaded === 'failed') continue;
      if (id === 'lamp' || id === 'lamp-double') {
        loaded.material.emissive = new Color('#FFE2A8');
        loaded.material.emissiveIntensity = 2.2 * glow;
      } else if (id.startsWith('townhouse-') || id.startsWith('tower-') || id.startsWith('school-')) {
        // Lived-in homes glow faintly warm through `aLit`; towers and schools glow as offices do.
        loaded.material.emissiveIntensity = (id.startsWith('townhouse-') ? 0.06 : 0.04) * glow;
      }
    }
  }

  /**
   * One frame under the orbit: the canvas sized to the pixels, the camera at the eye looking at the target.
   * @returns the frames rendered so far
   */
  render(orbit: Orbit, width: number, height: number, dpr: number): number {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = (orbit.fov * 180) / Math.PI;
    this.camera.near = Math.max(0.5, orbit.distance / 500);
    this.camera.far = Math.max(5000, orbit.distance * 40);
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(toGl(eyeOf(orbit)));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(toGl(orbit.target));
    const started = performance.now();
    this.renderer.info.reset();
    if (this.lite) this.renderer.render(this.scene, this.camera);
    else {
      if (!this.composer) {
        const px = { x: Math.round(width * dpr), y: Math.round(height * dpr) };
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        // Ambient occlusion (GTAOPass) was tried and dropped: its second pass over the scene cost a third of every
        // frame at 100,000 people for little the eye could see at a city's scale (plan Phase 7).
        this.bloom = new UnrealBloomPass(new Vector2(px.x, px.y), 0.05 + 0.45 * (1 - this.sun_.daylight), 0.4, 1.2 - 0.5 * (1 - this.sun_.daylight));
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
      }
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(width, height);
      this.composer.render();
    }
    const took = performance.now() - started;
    this.lastMs = took;
    if (!this.lite && took > LITE_PAST_MS) this.goLite();
    this.frames++;
    return this.frames;
  }

  /** Go lite: a plain render, one detailed neighborhood, no bulk vegetation. Called when a frame is too slow for the
   * composer, by this renderer's own CPU time or by the view from the gap between animation frames (the GPU's time,
   * which the CPU clock cannot see). */
  goLite(): void {
    if (this.lite) return;
    this.lite = true;
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
  }

  /** Whether the composer (ambient occlusion and bloom) is on, or a plain render stands in. */
  get composed(): boolean {
    return !this.lite;
  }

  /** Whether the renderer has gone lite: a frame took too long for the composer, so it also details one neighborhood
   * only and skips the bulk vegetation (software GL, where the flows run; a GPU never gets here). */
  get isLite(): boolean {
    return this.lite;
  }

  /** What the last frame drew: draw calls, triangles, and how long it took. */
  get drawn(): { calls: number; triangles: number; ms: number } {
    return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, ms: this.lastMs };
  }

  /** Let every GL resource go. */
  dispose(): void {
    for (const c of this.chunks.values()) for (const m of [...c.meshes, ...c.sub]) m.geometry.dispose();
    this.chunks.clear();
    for (const g of this.homeGroups.values()) {
      g.mesh?.dispose();
      g.geometry?.dispose();
    }
    this.homeGroups.clear();
    this.trees?.dispose();
    this.treeGeometry.dispose();
    for (const m of this.movers.values()) {
      m.geometry.dispose();
      m.dispose();
    }
    for (const m of this.props.values()) m.dispose();
    for (const m of this.traffic.values()) m.dispose();
    for (const m of this.treeMeshes) m.dispose();
    for (const m of this.shore) m.geometry.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.ground?.geometry.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}

/** The count of variants, re-exported so the adapter's callers need not import the facade module for it. */
export { HOME_VARIANTS };
